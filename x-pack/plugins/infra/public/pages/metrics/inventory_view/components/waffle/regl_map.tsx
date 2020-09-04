/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { mapValues, memoize, zip, first, debounce, isEqual } from 'lodash';
import REGL, { Regl } from 'regl';
import { useUiSetting } from '../../../../../../../../../src/plugins/kibana_react/public';
import { colorFromValue } from '../../lib/color_from_value';
import { createMetricThresholdAlertType } from 'x-pack/plugins/infra/public/alerting/metric_threshold';

type DynamicValue = (context: REGL.DefaultContext, props: { [name: string]: any }) => any;

type KbnGLDrawConfig = REGL.DrawConfig & {
  attributes: { [name: string]: REGL.Attribute | DynamicValue };
  uniforms: { [name: string]: REGL.Uniform | DynamicValue };
  count: DynamicValue;
};

const initializeREGLWithProcedures = (
  canvas: HTMLCanvasElement,
  procedures: Record<string, KbnGLDrawConfig>
) => {
  const regl = REGL(canvas);
  return {
    regl,
    procedures: mapValues(procedures, (proc) => regl(proc)),
  };
};

interface Props {
  map: { points: Record<string, Point>; groups: Record<string, Group>; height: number };
}

const ReglCanvas = ({ map, width, height }: Props) => {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const [glInstance, setGLInstance] = useState<{
    regl: Regl;
    procedures: Record<string, REGL.DrawCommand>;
  } | null>(null);
  const [hasInitialized, setHasInititialized] = useState(false);
  const [prevMap, setPrevMap] = useState({ points: {}, groups: {}, height: 0 });
  const [transition, setTransition] = useState<{
    animationQueue: Frame[];
    hasStarted: boolean;
    startTick: number;
    startNow: number;
  }>({
    animationQueue: [],
    hasStarted: false,
    startTick: 0,
    startNow: 0,
  });
  const [cameraPos, setCameraPos] = useState([0, 0, 1]);
  const { regl, procedures } = glInstance ?? {};
  const isDarkMode = useUiSetting<boolean>('theme:darkMode');

  useEffect(() => {
    if (canvasEl.current) {
      const compiledGL = initializeREGLWithProcedures(canvasEl.current, {
        drawPoints,
        drawRectangle: drawRectangle(isDarkMode),
      });
      setGLInstance(compiledGL);
    }
  }, [canvasEl]);

  useEffect(() => {
    if (regl) {
      setHasInititialized(true);
    }
  }, [regl]);

  useEffect(
    debounce(() => {
      if (map !== prevMap && !isEqual(map, prevMap)) {
        setPrevMap(map);
        setTransition({
          ...transition,
          hasStarted: false,
          animationQueue: generateTransition(prevMap, map),
        });
        setCameraPos([0, 0, 1]);
      }
    }, 100),
    [map, prevMap, transition]
  );

  useEffect(() => {
    if (regl && procedures && hasInitialized) {
      const loop = regl.frame((context) => {
        const { tick } = context;
        const { animationQueue, hasStarted, startTick, startNow } = transition;
        if (!hasStarted) {
          setTransition({
            ...transition,
            hasStarted: true,
            startTick: tick,
            startNow: performance.now(),
          });
          return;
        }
        const currentTick = tick - startTick;

        // In ideal conditions, tick is a more reliable way to generate a smooth 60fps animation, but
        // when performance drops, fall back to performance.now() so that the animation completes in the
        // expected amount of time
        const TARGET_FPS = 1000 / 60;
        const currentTimeDelta = Math.floor((performance.now() - startNow) / TARGET_FPS);

        const currentFrame = Math.min(
          currentTimeDelta - currentTick > 5 ? currentTimeDelta : currentTick,
          animationQueue.length - 1
        );
        if (animationQueue[currentFrame]) {
          procedures.drawPoints({
            points: animationQueue[currentFrame].points,
            cameraPos,
          });
          for (const group of animationQueue[currentFrame].groups) {
            procedures.drawRectangle({ group, cameraPos });
          }
        }
      });
      return () => {
        loop.cancel();
      };
    }
  }, [regl, hasInitialized, transition, procedures, cameraPos]);

  const onScroll = useCallback(
    (e) => {
      const zooming = e.ctrlKey || e.metaKey;
      if (zooming) e.preventDefault();
      const { deltaY, deltaMode } = e;
      const [cameraX, cameraY, cameraZ] = cameraPos;
      const delta = deltaY * Math.max(1, 8 * deltaMode);
      if (zooming) {
        const newCameraZ = Math.min(5, Math.max(0.2, cameraZ - delta / 100));
        setCameraPos([cameraX, cameraY, newCameraZ]);
        return;
      }
      const mapBounds = (map?.height ?? 0) - height;
      if (mapBounds <= 0) return;
      const newCameraY = Math.max(Math.min(cameraY - delta, 0), -mapBounds);
      setCameraPos([cameraX, newCameraY, cameraZ]);
    },
    [cameraPos, map]
  );

  return <canvas width={width} height={height} ref={canvasEl} onWheel={onScroll} />;
};

export const ReglWaffleMap = ({ groupsWithLayout, options, bounds, width, height }) => {
  return (
    <ReglCanvas
      map={groupsToMap(groupsWithLayout, options, bounds, width, height)}
      width={width}
      height={height}
    />
  );
};

const rgbaToGLColor = memoize((rgba: string) => {
  const hexValues = rgba.replace('#', '').match(/.{1,2}/g) ?? [];
  return hexValues.map((value) => parseInt(value, 16) / 255);
});

const rgbToGLColor = memoize((rgb: string) => rgbaToGLColor(`${rgb}ff`));

interface Point {
  x: number;
  y: number;
  size: number;
  color: number[];
}

interface Group {
  x: number;
  y: number;
  height: number;
  width: number;
}

interface Frame {
  points: Point[];
  groups: Group[];
}

const transitionPoints = (pA: Point[], pB: Point[], duration: number, offset: number = 0) => {
  const deltas = pB.map((pointB, i) => {
    const pointA = pA[i];
    return {
      x: pointB.x - pointA.x,
      y: pointB.y - pointA.y,
      size: pointB.size - pointA.size,
      color: pointB.color.map((rgbVal, rgbIdx) => rgbVal - pointA.color[rgbIdx]),
    };
  });
  const offsetDuration = Math.floor(offset * (pA.length - 1));
  const trueDuration = duration - offsetDuration;
  const tweenDuration = trueDuration - 2 + offsetDuration;
  const tween = Array.from(Array(tweenDuration), (_, i) =>
    pA
      .map((point, idx) => {
        const frame = Math.min(Math.max(0, i + 1 - offset * idx), trueDuration);
        const progress = easeOutBack(frame / trueDuration);
        return {
          x: point.x + deltas[idx].x * progress,
          y: point.y + deltas[idx].y * progress,
          size: point.size + deltas[idx].size * progress,
          color: point.color.map((rgbVal, rgbIdx) => rgbVal + deltas[idx].color[rgbIdx] * progress),
        };
      })
      .filter(({ size }) => size > 0.01)
  );

  return tween;
};

function easeOutBack(x: number): number {
  const c1 = 1.05;
  const c3 = c1 + 1;

  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}
const nodesToPointRecord = memoize((layoutNodes, options, bounds, xOrigin, yOrigin) => {
  const { width, count, squareSize, nodes } = layoutNodes;
  if (!width) return {};
  const MIN_SPACING = 4;
  const Y_PADDING = 64;
  const spacedSquareSize = squareSize + MIN_SPACING;
  const nodesPerLine = Math.floor(width / spacedSquareSize);
  const totalRows = Math.ceil(nodes.length / nodesPerLine);
  const height = totalRows * spacedSquareSize + Y_PADDING;
  const xOffset =
    xOrigin + spacedSquareSize / 2 + Math.floor(width - nodesPerLine * spacedSquareSize) / 2;
  const yOffset = yOrigin + Y_PADDING / 2 + spacedSquareSize / 2;

  const nodesInLastRow = count - nodesPerLine * (totalRows - 1);
  const lastRowDelta = nodesPerLine - nodesInLastRow;
  const lastRowXOffset =
    lastRowDelta % 2
      ? (lastRowDelta * spacedSquareSize) / 2
      : (lastRowDelta / 2) * spacedSquareSize;

  const points = nodes.reduce((result: Record<string, Point>, node, i) => {
    const row = Math.floor(i / nodesPerLine);
    const col = i % nodesPerLine;
    const metric = first(node.metrics);
    const rawValue = (metric && metric.value) || 0;
    const color = colorFromValue(options.legend, rawValue, bounds);

    return {
      ...result,
      [node.name]: {
        x: xOffset + spacedSquareSize * col + (row + 1 === totalRows ? lastRowXOffset : 0),
        y: yOffset + spacedSquareSize * row,
        size: squareSize,
        color: rgbToGLColor(color),
        pathId: node.pathId,
      },
    };
  }, {});
  return { points, group: { x: xOrigin, y: yOrigin, width, height } };
});

const groupsToMap = memoize((groupsWithLayout, options, bounds, stageWidth) => {
  const groups = {};
  const points = {};
  const X_PADDING = 24;
  const Y_PADDING = 12;
  const groupWidth = groupsWithLayout[0].width + X_PADDING;
  const groupsPerRow = Math.min(Math.floor(stageWidth / groupWidth), groupsWithLayout.length);
  const rowWidth = groupWidth * groupsPerRow;
  const initialXOrigin = (stageWidth - rowWidth) / 2;
  let yOrigin = 0;
  let xOrigin = initialXOrigin;
  let rowHeight = 0;
  groupsWithLayout.forEach((group, i) => {
    const result = nodesToPointRecord(group, options, bounds, xOrigin, yOrigin);
    if (result.group) {
      const { height } = result.group;
      rowHeight = Math.max(rowHeight, height);
      if ((i + 1) % groupsPerRow) {
        xOrigin += groupWidth;
      } else {
        const remainingGroups = groupsWithLayout.length - (i + 1);
        const isLastRow = remainingGroups < groupsPerRow;
        xOrigin = !isLastRow ? initialXOrigin : (stageWidth - remainingGroups * groupWidth) / 2;
        yOrigin += rowHeight + Y_PADDING;
        rowHeight = 0;
      }
      groups[group.id] = result.group;
      Object.entries(result.points).forEach(([key, value]) => {
        // If a node name shows up in multiple groups, use that node name in the final group, and
        // key previous groups' nodes with their pathIds. This helps create more informative transitions
        // when new groups are added: previously-existing nodes will be animated MOVING to the new group,
        // and replaced with a copy in their original group, rather than just staying put and having a
        // new copy materialize in the new group.
        if (Reflect.has(points, key)) {
          Reflect.set(points, points[key].pathId, points[key]);
        }
        Reflect.set(points, key, value);
      });
    }
  });
  const mapHeight = yOrigin + rowHeight;
  return { points, groups, height: mapHeight };
});

const standardTween = (
  startFrame: Point[],
  endFrame: Point[],
  targetNodeDuration: number,
  maxTotalDuration: number
) => {
  if (!startFrame.length) return [];
  let duration;
  let offset = 1;
  const offset1Duration = startFrame.length + targetNodeDuration;
  if (offset1Duration <= maxTotalDuration) {
    duration = offset1Duration;
  } else {
    duration = maxTotalDuration;
    offset = Math.max(0, (maxTotalDuration - targetNodeDuration) / startFrame.length);
  }
  return transitionPoints(startFrame, endFrame, duration, offset);
};

const generatePointTransition = (prevPoints = {}, nextPoints = {}) => {
  const movingPointIDs = [];
  const enteringPointIDs = [];
  const exitingPointIDs = [];
  const pointIDs = new Set([...Object.keys(prevPoints), ...Object.keys(nextPoints)]);
  for (const id of pointIDs) {
    const existsInPrev = Reflect.has(prevPoints, id);
    const existsInNext = Reflect.has(nextPoints, id);
    if (existsInPrev && existsInNext) movingPointIDs.push(id);
    else if (existsInNext) enteringPointIDs.push(id);
    else if (existsInPrev) exitingPointIDs.push(id);
  }

  const movingStartFrame = movingPointIDs.map((id) => prevPoints[id]);
  const movingEndFrame = movingPointIDs.map((id) => nextPoints[id]);

  const enteringStartFrame = enteringPointIDs.map((id) => ({
    ...nextPoints[id],
    size: 0.001,
  }));
  const enteringEndFrame = enteringPointIDs.map((id) => nextPoints[id]);

  const exitingStartFrame = exitingPointIDs.map((id) => prevPoints[id]);
  const exitingEndFrame = exitingPointIDs.map((id) => ({
    ...prevPoints[id],
    size: 0.001,
  }));

  const targetDuration = 24;
  const maxDuration = 48;

  const movingTween = standardTween(movingStartFrame, movingEndFrame, targetDuration, maxDuration);
  const enteringTween = standardTween(
    enteringStartFrame,
    enteringEndFrame,
    targetDuration,
    maxDuration
  );
  const exitingTween = standardTween(
    exitingStartFrame,
    exitingEndFrame,
    targetDuration,
    maxDuration
  );

  if (enteringTween.length < Math.max(exitingTween.length, movingTween.length)) {
    const extraFramesNeeded =
      Math.max(exitingTween.length, movingTween.length) - enteringTween.length;
    for (let i = 0; i < extraFramesNeeded; i++) {
      enteringTween.unshift([]);
    }
  }

  if (movingTween.length < Math.max(exitingTween.length, enteringTween.length)) {
    const extraFramesNeeded =
      Math.max(exitingTween.length, enteringTween.length) - movingTween.length;
    for (let i = 0; i < extraFramesNeeded; i++) {
      movingTween.push(movingEndFrame);
    }
  }

  const mergedTween = zip(movingTween, enteringTween, exitingTween).map((tween) =>
    tween.flat().filter(Boolean)
  );
  const startFrame = [...movingStartFrame, ...exitingStartFrame];
  const endFrame = [...movingEndFrame, ...enteringEndFrame];

  return [startFrame, ...mergedTween, endFrame];
};

const generateGroupTransition = (prevGroups = {}, nextGroups = {}) => {
  const movingGroupIDs = [];
  const enteringGroupIDs = [];
  const exitingGroupIDs = [];

  const groupIDs = new Set([...Object.keys(prevGroups), ...Object.keys(nextGroups)]);

  for (const id of groupIDs) {
    const existsInPrev = Reflect.has(prevGroups, id);
    const existsInNext = Reflect.has(nextGroups, id);
    if (existsInPrev && existsInNext) movingGroupIDs.push(id);
    else if (existsInNext) enteringGroupIDs.push(id);
    else if (existsInPrev) exitingGroupIDs.push(id);
  }

  const movingStartFrame = movingGroupIDs.map((id) => prevGroups[id]);
  const movingEndFrame = movingGroupIDs.map((id) => nextGroups[id]);

  const enteringStartFrame = enteringGroupIDs.map((id) => ({
    ...nextGroups[id],
    width: 0.001,
    height: 1,
  }));
  const enteringEndFrame = enteringGroupIDs.map((id) => nextGroups[id]);

  const exitingStartFrame = exitingGroupIDs.map((id) => prevGroups[id]);
  const exitingEndFrame = exitingGroupIDs.map((id) => ({
    ...prevGroups[id],
    height: 0,
    width: 0,
  }));

  const duration = 90;

  const movingTween = tweenGroups(movingStartFrame, movingEndFrame, duration);
  const enteringTween = tweenGroups(enteringStartFrame, enteringEndFrame, duration);
  const exitingTween = tweenGroups(exitingStartFrame, exitingEndFrame, duration);

  // if (enteringTween.length < Math.max(exitingTween.length, movingTween.length)) {
  //   const extraFramesNeeded =
  //     Math.max(exitingTween.length, movingTween.length) - enteringTween.length;
  //   for (let i = 0; i < extraFramesNeeded; i++) {
  //     enteringTween.unshift([]);
  //   }
  // }

  // if (movingTween.length < Math.max(exitingTween.length, enteringTween.length)) {
  //   const extraFramesNeeded =
  //     Math.max(exitingTween.length, enteringTween.length) - movingTween.length;
  //   for (let i = 0; i < extraFramesNeeded; i++) {
  //     movingTween.push(movingEndFrame);
  //   }
  // }

  const mergedTween = zip(movingTween, enteringTween, exitingTween).map((tween) =>
    tween.flat().filter(Boolean)
  );
  const startFrame = [...movingStartFrame, ...exitingStartFrame];
  const endFrame = [...movingEndFrame, ...enteringEndFrame];

  return [startFrame, ...mergedTween, endFrame];
  return [endFrame];
};

const tweenGroups = (startFrame, endFrame, duration) => {
  if (!startFrame.length) return [];
  const deltas = endFrame.map((endGroup, i) => ({
    height: endGroup.height - startFrame[i].height,
    width: endGroup.width - startFrame[i].width,
    x: endGroup.x - startFrame[i].x,
    y: endGroup.y - startFrame[i].y,
  }));
  const tween = Array.from(Array(duration), (_, i) =>
    startFrame.map((group, idx) => {
      const frame = Math.min(Math.max(0, i + 1), duration);
      const progress = easeOutBack(frame / duration);
      const xProgress = Math.min(1, progress * 2);
      const yProgress = Math.min(1, Math.max(0, progress * 2 - 0.5));
      return {
        ...group,
        width: group.width + deltas[idx].width * xProgress,
        x: group.x + deltas[idx].x * xProgress,
        height: group.height + deltas[idx].height * yProgress,
        y: group.y + deltas[idx].y * yProgress,
      };
    })
  );
  return [startFrame, ...tween, endFrame];
};

const generateTransition = (prevMap, nextMap, animated = true) => {
  const { groups: prevGroups, points: prevPoints } = prevMap;
  const { groups: nextGroups, points: nextPoints } = nextMap;

  const pointTransition = generatePointTransition(prevPoints, nextPoints, animated);
  const groupTransition = generateGroupTransition(prevGroups, nextGroups, animated);

  return pointTransition.map(
    (frame, i) =>
      ({
        points: pointTransition[i],
        groups: groupTransition[Math.min(i, groupTransition.length - 1)],
      } as Frame)
  );
};

const vertWithNormalizeCoords = (vertexShaderCode: TemplateStringsArray) => `
uniform float stageWidth;
uniform float stageHeight;

vec2 normalizeCoords(vec2 position) {
  float x = position[0];
  float y = position[1];

  return vec2(
    2.0 * ((x / stageWidth) - 0.5),
    -(2.0 * ((y / stageHeight) - 0.5))
  );
}
${vertexShaderCode}
`;

const drawPoints: KbnGLDrawConfig = {
  vert: vertWithNormalizeCoords`
  precision mediump float;
  attribute vec2 position;
  attribute float pointWidth;
  attribute vec3 cameraPos;
  attribute lowp vec4 color;

  varying lowp vec4 v_pointColor;
  
  void main () {
    gl_PointSize = pointWidth * pow(cameraPos.z, -1.);
    gl_Position = vec4(normalizeCoords(position + cameraPos.xy), 0, cameraPos.z);
    v_pointColor = color;
  }`,

  frag: `
  precision mediump float;

  varying lowp vec4 v_pointColor;

  void main () {
     gl_FragColor = v_pointColor;
  }`,

  attributes: {
    position: (context, props) => props.points.map((point: Point) => [point.x, point.y]),
    pointWidth: (context, props) => props.points.map((point: Point) => point.size),
    color: (context, props) => props.points.map((point: Point) => point.color),
    cameraPos: (context, props) => props.points.map(() => props.cameraPos),
  },
  uniforms: {
    stageWidth: (context) => context.drawingBufferWidth,
    stageHeight: (context) => context.drawingBufferHeight,
  },

  count: (context, props) => props.points.length,
  primitive: 'points',
};

const drawRectangle: (isDarkMode: boolean) => KbnGLDrawConfig = (isDarkMode: boolean) => ({
  vert: vertWithNormalizeCoords`
  precision mediump float;
  attribute vec2 vertex;
  attribute vec3 cameraPos;
  attribute lowp vec4 color;

  void main () {
    gl_Position = vec4(normalizeCoords(vertex + cameraPos.xy), 0, cameraPos.z);
  }  
  `,
  frag: `
  precision mediump float;

  uniform lowp vec4 color;

  void main () {
     gl_FragColor = color;
  }`,

  attributes: {
    vertex: (context, props) => {
      const { x, y, width, height } = props.group;
      return [
        [x, y],
        [x, y + height],
        [x + width, y + height],
        [x + width, y + height],
        [x + width, y],
        [x, y],
      ];
    },
    cameraPos: (context, props) => Array.from(Array(6), () => props.cameraPos),
  },
  uniforms: {
    color: isDarkMode ? [0, 0, 0, 0.3] : [0, 0, 0, 0.05],
    stageWidth: (context) => context.drawingBufferWidth,
    stageHeight: (context) => context.drawingBufferHeight,
  },

  count: 6,
});

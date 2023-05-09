/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import moment from 'moment';
import { RRule, Weekday } from '@kbn/rrule';
import React, { useCallback, useState, useMemo, useLayoutEffect, useRef } from 'react';
import {
  EuiFlexItem,
  EuiText,
  EuiBadge,
  EuiPanel,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiSpacer,
  EuiButton,
  EuiToolTip,
} from '@elastic/eui';
import { euiStyled } from '@kbn/kibana-react-plugin/common';
import { IsoWeekday, RuleSnooze } from '@kbn/alerting-plugin/common';
import { useFindMaintenanceWindows } from '@kbn/alerting-plugin/public';
import { euiThemeVars } from '@kbn/ui-theme';
import { ISO_WEEKDAYS } from '../../../../common/constants';

interface CalendarRowProps {
  days: Array<{
    heading: string;
    isToday?: boolean;
    snoozes?: any[];
    maintenanceWindows?: any[];
  }>;
}

const CalendarRow = ({ days }: CalendarRowProps) => {
  const allDayEventLengthMap = days.reduce(
    (
      result: Record<string, { length: number; days: number[] }>,
      { snoozes, maintenanceWindows },
      i
    ) => {
      snoozes?.forEach((s) => {
        if (!result[s.id]) result[s.id] = { length: 0, days: [] };
        result[s.id].length += 1;
        result[s.id].days.push(i);
      });
      maintenanceWindows?.forEach((w) => {
        if (!result[w.id]) result[w.id] = { length: 0, days: [] };
        result[w.id].length += 1;
        result[w.id].days.push(i);
      });
      return result;
    },
    {}
  );

  const allDayEventOrder: Record<string, number> = {};

  for (let i = 0; i < days.length; i++) {
    const { snoozes, maintenanceWindows } = days[i];
    const allDayEvents = [...(snoozes ?? []), ...(maintenanceWindows ?? [])].sort((a, b) => {
      return (
        (allDayEventLengthMap[b.id].length ?? 0) - (allDayEventLengthMap[a.id].length ?? 0) ||
        (a.id > b.id ? 1 : -1)
      );
    });

    for (let eventIdx = 0; eventIdx < allDayEvents.length; eventIdx++) {
      const event = allDayEvents[eventIdx];
      const currentPos = allDayEventOrder[event.id] ?? 0;
      allDayEventOrder[event.id] = Math.max(currentPos, eventIdx);
    }
  }

  console.log(allDayEventOrder);

  return (
    <>
      {days.map(({ heading, isToday, snoozes, maintenanceWindows }, i) => {
        const eventBadges = [
          ...(snoozes ?? []).map((s) => ({ ...s, color: 'primary' })),
          ...(maintenanceWindows ?? []).map((w) => ({ ...w, color: 'accent' })),
        ];
        const allDayEvents = [];
        for (const event of eventBadges) {
          const { id } = event;
          const index = allDayEventOrder[id];
          allDayEvents[index] = event;
        }
        for (let idx = 0; idx < allDayEvents.length; idx++) {
          if (!allDayEvents[idx]) allDayEvents[idx] = null;
        }

        console.log(allDayEvents);

        return (
          <CalendarDay key={`calendar-day-${heading}`}>
            <EuiSpacer size="xs" />
            {isToday ? (
              <EuiBadge color="primary">{heading}</EuiBadge>
            ) : (
              <EuiText size="xs">{heading}</EuiText>
            )}
            {allDayEvents.map((e, idx) =>
              !e ? (
                <AllDayEventSpacer />
              ) : (
                <AllDayEventBadge key={e.id} color={e.color} isStart={e.isStart} isEnd={e.isEnd}>
                  {e.isStart || i === 0 ? e.title : ' '}
                </AllDayEventBadge>
              )
            )}
          </CalendarDay>
        );
      })}
    </>
  );
};

const HeightWrapper: React.FC<{ padding?: number; minHeight?: number }> = ({
  children,
  padding = 0,
  minHeight = 600,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const onSizeChange = useCallback(
    (rectTop: number, innerHeight: number) => {
      setHeight(Math.max(minHeight, innerHeight - rectTop - padding * 2));
    },
    [padding, minHeight]
  );

  useLayoutEffect(() => {
    if (ref.current) {
      const resizeObserver = new ResizeObserver(() => {
        const { top } = ref.current!.getBoundingClientRect();
        onSizeChange(top, window.innerHeight);
      });
      resizeObserver.observe(ref.current);
    }
  }, [ref, onSizeChange]);

  return (
    <div ref={ref} style={{ position: 'relative', height, padding }}>
      {children}
    </div>
  );
};

function windowsToDisplayedOccurrences(schedule?: RuleSnooze, displayedMonthYear, weekRows) {
  if (!schedule) return [];
  const [month, year] = displayedMonthYear;
  const firstDisplayedDay = weekRows[0][0];
  const lastDisplayedDay = weekRows[weekRows.length - 1][6];
  const occurrences = schedule
    .map((snooze, i) => {
      const { rRule, duration, skipRecurrences, id } = snooze;
      const recurrenceRule = new RRule({
        ...rRule,
        dtstart: new Date(rRule.dtstart),
        until: rRule.until ? new Date(rRule.until) : null,
        byweekday: rRule.byweekday ?? null,
        wkst: rRule.wkst ? Weekday[rRule.wkst] : null,
      });
      const occurrences = recurrenceRule.between(
        moment().month(month).year(year).date(firstDisplayedDay).toDate(),
        moment().month(month).year(year).date(lastDisplayedDay).toDate()
      );
      return occurrences.reduce(
        (
          result: Array<{ start: moment.Moment; end: moment.Moment; title: string; id?: string }>,
          occurrence
        ) => {
          if (skipRecurrences?.includes(occurrence.toISOString())) return result;
          const start = moment(occurrence);
          const end = moment(start).add(duration, 'ms');
          const title = snooze.title ?? (snooze.id ? 'Scheduled snooze' : 'Relative snooze');
          return [...result, { start, end, id: id ?? `relative-${i}`, title }];
        },
        []
      );
    })
    .filter(Boolean)
    .flat();
  return occurrences.reduce(
    (
      result: Record<
        number,
        Array<{
          start: moment.Moment;
          end: moment.Moment;
          id?: string;
          isStart: boolean;
          isEnd: boolean;
        }>
      >,
      occurrence
    ) => {
      const startOfMonth = moment([year, month, 1]);
      const startDayIndex = Math.round(
        occurrence.start.hour(0).diff(startOfMonth, 'days', true) + 1
      );
      const endDayIndex = Math.round(occurrence.end.hour(0).diff(startOfMonth, 'days', true) + 1);
      for (let i = startDayIndex; i <= endDayIndex; i++) {
        if (!result[i]) result[i] = [];
        result[i].push({ ...occurrence, isStart: i === startDayIndex, isEnd: i === endDayIndex });
      }
      return result;
    },
    {}
  );
}

export interface RuleScheduleCalendarProps {
  wkst?: IsoWeekday;
  snoozeSchedule?: RuleSnooze;
}

export const RuleScheduleCalendar: React.FC<RuleScheduleCalendarProps> = ({
  wkst = 7,
  snoozeSchedule,
}) => {
  const today = useRef(moment());
  const [displayedMonthYear, setDisplayedMonthYear] = useState([
    today.current.month(),
    today.current.year(),
  ]);
  const weekdayOrder: IsoWeekday[] = useMemo(() => {
    const wkstIndex = ISO_WEEKDAYS.indexOf(wkst);
    return [...ISO_WEEKDAYS.slice(wkstIndex), ...ISO_WEEKDAYS.slice(0, wkstIndex)];
  }, [wkst]);

  const { maintenanceWindows, refetch } = useFindMaintenanceWindows({
    enabled: true,
  });

  const weekRows = useMemo(() => {
    const [month, year] = displayedMonthYear;
    const firstOfMonth = moment().month(month).year(year).date(1);
    const firstOfMonthIndex = weekdayOrder.indexOf(firstOfMonth.isoWeekday() as IsoWeekday);
    const firstWeek = weekdayOrder.map((_, i) => i - firstOfMonthIndex + 1);

    const weeks = [firstWeek];
    while (true) {
      const lastDayOfPrevWeek = weeks[weeks.length - 1][6];
      // Moment will roll over to the next month if setting a date that is above the number of days in
      // the specified month. If this happens, break the loop and stop adding new weeks.
      if (moment().month(month).date(lastDayOfPrevWeek).month() !== month) break;
      const newWeek = Array.from(Array(7), (_, i) => lastDayOfPrevWeek + i + 1);
      weeks.push(newWeek);
    }
    return weeks;
  }, [weekdayOrder, displayedMonthYear]);

  const displayedSnoozeRecurrences = useMemo(
    () => windowsToDisplayedOccurrences(snoozeSchedule, displayedMonthYear, weekRows),
    [snoozeSchedule, weekRows, displayedMonthYear]
  );
  const displayedMaintenanceRecurrences = useMemo(() => {
    return windowsToDisplayedOccurrences(maintenanceWindows, displayedMonthYear, weekRows);
  }, [maintenanceWindows, weekRows, displayedMonthYear]);

  const calendarRows = useMemo(
    () =>
      weekRows.map((week, weekIdx) => {
        const [month, year] = displayedMonthYear;

        const days = week.map((d) => {
          const dateMoment = moment().month(month).year(year).date(d);
          const actualDateOfMonth = dateMoment.date();
          const heading =
            actualDateOfMonth === 1 ? `${dateMoment.format('MMM D')}` : String(actualDateOfMonth);
          return {
            heading,
            isToday:
              dateMoment.diff(today.current, 'days') === 0 &&
              dateMoment.date() === today.current.date(),
            snoozes: displayedSnoozeRecurrences[d],
            maintenanceWindows: displayedMaintenanceRecurrences[d],
          };
        });

        return <CalendarRow days={days} key={`week-${weekIdx}`} />;
      }),
    [weekRows, displayedMonthYear, displayedSnoozeRecurrences, displayedMaintenanceRecurrences]
  );

  const monthYearHeading = useMemo(
    () => moment().month(displayedMonthYear[0]).year(displayedMonthYear[1]).format('MMMM YYYY'),
    [displayedMonthYear]
  );

  const onClickMonthBack = useCallback(() => {
    const [month, year] = displayedMonthYear;
    const newMonthDate = moment().month(month).year(year).subtract(1, 'month');
    setDisplayedMonthYear([newMonthDate.month(), newMonthDate.year()]);
  }, [displayedMonthYear]);

  const onClickMonthForward = useCallback(() => {
    const [month, year] = displayedMonthYear;
    const newMonthDate = moment().month(month).year(year).add(1, 'month');
    setDisplayedMonthYear([newMonthDate.month(), newMonthDate.year()]);
  }, [displayedMonthYear]);

  const onClickToday = useCallback(() => {
    setDisplayedMonthYear([today.current.month(), today.current.year()]);
  }, [today]);

  return (
    <EuiPanel hasBorder={false} hasShadow={false}>
      <EuiFlexGroup alignItems="center" justifyContent="flexStart" gutterSize="m">
        <EuiFlexItem grow={false}>
          <EuiToolTip position="bottom" content={today.current.format('dddd MMMM D')}>
            <EuiButton size="s" color="text" onClick={onClickToday}>
              Today
            </EuiButton>
          </EuiToolTip>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonIcon iconType="arrowLeft" onClick={onClickMonthBack} />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonIcon iconType="arrowRight" onClick={onClickMonthForward} />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText>
            <h3>{monthYearHeading}</h3>
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <HeightWrapper>
        <CalendarGrid>
          {weekdayOrder.map((weekday) => (
            <CalendarHeading>{moment().isoWeekday(weekday).format('ddd')}</CalendarHeading>
          ))}
          {calendarRows}
        </CalendarGrid>
      </HeightWrapper>
    </EuiPanel>
  );
};

const SEVENTH = `${100 / 7}%`;
const CalendarGrid = euiStyled.div`
  display: grid;
  grid-template-columns: ${SEVENTH} ${SEVENTH} ${SEVENTH} ${SEVENTH} ${SEVENTH} ${SEVENTH} ${SEVENTH};
  grid-template-rows: 24px auto;
  position: relative;
  height: 100%;
  min-height: 600px;
  border: 1px solid ${euiThemeVars.euiColorLightShade};
  border-radius: 8px;
`;

const CalendarDay = euiStyled(EuiFlexItem)`
  align-items: center;
  border-right: 1px solid ${euiThemeVars.euiColorLightShade};
  border-bottom: 1px solid ${euiThemeVars.euiColorLightShade};
  position: relative;
  &:nth-child(7n) {
    border-right: none;
  }
  &:nth-last-child(-n + 7) {
    border-bottom: none;
  }
`;

const CalendarHeading = euiStyled(EuiFlexItem).attrs({ grow: false })`
  background-color: ${euiThemeVars.euiColorLightestShade};
  border-bottom: 1px solid ${euiThemeVars.euiColorLightShade};
  justify-content: center;
  align-items: center;
  padding 8px;
  &:nth-child(1) {
    border-top-left-radius: 8px;
  }
  &:nth-child(7) {
    border-top-right-radius: 8px;
  }
  font-weight: bold;
  text-transform: uppercase;
  font-size: ${euiThemeVars.euiFontSizeXS};
  color: ${euiThemeVars.euiTextSubduedColor};
`;

const AllDayEventBadge = euiStyled(EuiBadge)`
  display: block;
  width: 100%;
  transform: scaleX(1.05);
  margin: 1px 0;
  margin-inline-start: ${(props) => (props.isStart ? '16px' : 0)} !important;
  margin-inline-end: ${(props) => (props.isEnd ? '17px' : 0)};
  z-index: 1;
  ${(props) =>
    props.isStart &&
    !props.isEnd &&
    `
  z-index: 2;
  & * {
    overflow: visible !important;
  }
`}
`;

const AllDayEventSpacer = euiStyled(EuiSpacer)`
  block-size: 22px;
`;

// eslint-disable-next-line import/no-default-export
export { RuleScheduleCalendar as default };

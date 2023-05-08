/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import moment from 'moment';
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
import { IsoWeekday } from '@kbn/alerting-plugin/common';
import { euiThemeVars } from '@kbn/ui-theme';
import { ISO_WEEKDAYS } from '../../../../common/constants';

const CalendarRow = ({ days }) => {
  return days.map(({ heading, isToday }) => (
    <CalendarDay key={`calendar-day-${heading}`}>
      {isToday ? (
        <EuiBadge color="primary">{heading}</EuiBadge>
      ) : (
        <EuiText size="xs">{heading}</EuiText>
      )}
    </CalendarDay>
  ));
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

export const RuleScheduleCalendar = ({ wkst = 7 }) => {
  const today = useRef(moment());
  const [displayedMonthYear, setDisplayedMonthYear] = useState([
    today.current.month(),
    today.current.year(),
  ]);
  const weekdayOrder: IsoWeekday[] = useMemo(() => {
    const wkstIndex = ISO_WEEKDAYS.indexOf(wkst);
    return [...ISO_WEEKDAYS.slice(wkstIndex), ...ISO_WEEKDAYS.slice(0, wkstIndex)];
  }, [wkst]);

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

  const calendarRows = useMemo(
    () =>
      weekRows.map((week, weekIdx) => {
        const [month, year] = displayedMonthYear;

        const days = week.map((d) => {
          const dateMoment = moment().month(month).year(year).date(d);
          const actualDateOfMonth = dateMoment.date();
          if (actualDateOfMonth === 1) return { heading: `${dateMoment.format('MMM D')}` };
          return {
            heading: String(actualDateOfMonth),
            isToday:
              dateMoment.diff(today.current, 'days') === 0 &&
              dateMoment.date() === today.current.date(),
          };
        });

        return <CalendarRow days={days} key={`week-${weekIdx}`} />;
      }),
    [weekRows, displayedMonthYear]
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
  padding: 8px;
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

// eslint-disable-next-line import/no-default-export
export { RuleScheduleCalendar as default };

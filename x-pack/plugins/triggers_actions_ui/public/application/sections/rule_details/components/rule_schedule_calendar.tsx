/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import moment from 'moment';
import { generatePath } from 'react-router-dom';
import { RRule, Weekday } from '@kbn/rrule';
import React, { useCallback, useContext, useState, useMemo, useLayoutEffect, useRef } from 'react';
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
  EuiPopover,
  EuiWrappingPopover,
  EuiPopoverTitle,
  EuiIcon,
  EuiPopoverFooter,
} from '@elastic/eui';
import { euiStyled } from '@kbn/kibana-react-plugin/common';
import { useUiSetting } from '@kbn/kibana-react-plugin/public';
import { IsoWeekday, RuleSnoozeSchedule } from '@kbn/alerting-plugin/common';
import { useFindMaintenanceWindows } from '@kbn/alerting-plugin/public';
import { euiThemeVars } from '@kbn/ui-theme';
import {
  SNOOZE_SUCCESS_MESSAGE,
  UNSNOOZE_SUCCESS_MESSAGE,
  SNOOZE_FAILED_MESSAGE,
} from '../../rules_list/components/notify_badge/translations';
import { useKibana } from '../../../../common/lib/kibana';
import { unsnoozeRule } from '../../../lib/rule_api/unsnooze';
import { snoozeRule } from '../../../lib/rule_api/snooze';
import { RuleSnoozeScheduler } from '../../rules_list/components/rule_snooze/scheduler';
import { ISO_WEEKDAYS } from '../../../../common/constants';
import { scheduleSummary } from '../../rules_list/components/rule_snooze/panel/helpers';

type EventWindow = RuleSnoozeSchedule & {
  title?: string;
};

interface DisplayedOccurrence {
  title: string;
  id: string;
  start: string;
  end: string;
  allDay: boolean;
  isStart: boolean;
  isEnd: boolean;
  tzid: string;
  recurrenceSummary?: string;
  type: 'scheduledSnooze' | 'relativeSnooze' | 'maintenanceWindow';
  eventObject: EventWindow;
}

interface CalendarRowProps {
  days: Array<{
    heading: string;
    isToday?: boolean;
    snoozes?: DisplayedOccurrence[];
    maintenanceWindows?: DisplayedOccurrence[];
    date: moment.Moment;
  }>;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const useDefaultTimzezone = () => {
  const kibanaTz: string = useUiSetting('dateFormat:tz');
  if (!kibanaTz || kibanaTz === 'Browser') return moment.tz?.guess() ?? 'UTC';
  return kibanaTz;
};

const CalendarRow = ({ days }: CalendarRowProps) => {
  const [openPopover, setOpenPopover] = useState(null);
  const popoverAnchors = useRef<Record<string, React.Ref<HTMLElement>>>({});

  useLayoutEffect(() => {
    for (const { snoozes, maintenanceWindows, heading } of days) {
      snoozes?.forEach((s) => {
        if (!popoverAnchors.current[s.id]) popoverAnchors.current[s.id] = React.createRef();
      });
      maintenanceWindows?.forEach((w) => {
        if (!popoverAnchors.current[w.id]) popoverAnchors.current[w.id] = React.createRef();
      });
      if (!popoverAnchors.current[`calendar-day-${heading}`])
        popoverAnchors.current[`calendar-day-${heading}`] = React.createRef();
    }
  }, [days]);

  const allDayEventLengthMap = days.reduce(
    (
      result: Record<string, { length: number; days: number[] }>,
      { snoozes, maintenanceWindows },
      i
    ) => {
      snoozes?.forEach((s) => {
        if (!s.allDay) return;
        if (!result[s.id]) result[s.id] = { length: 0, days: [] };
        result[s.id].length += 1;
        result[s.id].days.push(i);
      });
      maintenanceWindows?.forEach((w) => {
        if (!w.allDay) return;
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
    const allDaySnoozes = snoozes?.filter((s) => s.allDay) ?? [];
    const allDayMaintenanceWindows = maintenanceWindows?.filter((w) => w.allDay) ?? [];

    const allDayEvents = [...allDaySnoozes, ...allDayMaintenanceWindows].sort((a, b) => {
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

  return (
    <>
      {days.map(({ heading, isToday, snoozes, maintenanceWindows, date }, i) => {
        const allDaySnoozes = snoozes?.filter((s) => s.allDay) ?? [];
        const allDayMaintenanceWindows = maintenanceWindows?.filter((w) => w.allDay) ?? [];
        const allDayEventBadges = [
          ...allDaySnoozes.map((s) => ({ ...s, color: 'primary' })),
          ...allDayMaintenanceWindows.map((w) => ({ ...w, color: 'accent' })),
        ];
        const allDayEvents = [];
        for (const event of allDayEventBadges) {
          const { id } = event;
          const index = allDayEventOrder[id];
          allDayEvents[index] = event;
        }
        for (let idx = 0; idx < allDayEvents.length; idx++) {
          if (!allDayEvents[idx]) allDayEvents[idx] = null;
        }

        const todaySnoozes = snoozes?.filter((s) => !s.allDay) ?? [];
        const todayMaintenanceWindows = maintenanceWindows?.filter((w) => !w.allDay) ?? [];
        const todayEvents = [
          ...todaySnoozes.map((s) => ({ ...s, color: 'primary' })),
          ...todayMaintenanceWindows.map((w) => ({ ...w, color: 'accent' })),
        ].sort((a, b) => moment(a.start).diff(b.start, 'ms'));

        return (
          <>
            <CalendarDay
              key={`calendar-day-${heading}`}
              id={`calendar-day-${heading}`}
              onClick={(clickEvent: { target: { id?: string } }) => {
                if (clickEvent.target.id === `calendar-day-${heading}`) {
                  setOpenPopover(`calendar-day-${heading}`);
                }
              }}
            >
              <EuiSpacer size="xs" />
              {isToday ? (
                <EuiBadge color="primary">{heading}</EuiBadge>
              ) : (
                <EuiBadge color="hollow" style={{ border: 'none' }}>
                  {heading}
                </EuiBadge>
              )}
              {allDayEvents.map((e, idx) =>
                !e ? (
                  <AllDayEventSpacer key={`spacer-${i}-${idx}`} />
                ) : (
                  <React.Fragment key={e.id}>
                    <AllDayEventBadge
                      color={e.color}
                      $isStart={e.isStart || i === 0}
                      $isEnd={e.isEnd || i === days.length - 1}
                      onClick={() => setOpenPopover(openPopover === e.id ? null : e.id)}
                    >
                      <span ref={e.isStart || i === 0 ? popoverAnchors.current[e.id] : null}>
                        {e.isStart || i === 0 ? e.title : ' '}
                      </span>
                    </AllDayEventBadge>
                    {(e.isStart || i === 0) && (
                      <EventPopover
                        event={e}
                        anchor={popoverAnchors.current[e.id]}
                        isOpen={openPopover === e.id}
                        onClose={() => setOpenPopover(null)}
                      />
                    )}
                  </React.Fragment>
                )
              )}
              {todayEvents.map((e, idx) => (
                <React.Fragment key={e.id}>
                  <TodayEventBadge
                    $color={e.color}
                    $isStart={i === 0}
                    $isEnd={i === days.length - 1}
                    onClick={() => setOpenPopover(openPopover === e.id ? null : e.id)}
                  >
                    <span ref={popoverAnchors.current[e.id]}>
                      {e.title}{' '}
                      <EuiText size="xs" color="subdued">
                        {moment(e.start).format(`h${moment(e.start).minute() > 0 ? ':mm' : ''}a`)}-
                        {moment(e.end).format(`h${moment(e.end).minute() > 0 ? ':mm' : ''}a`)}
                      </EuiText>
                    </span>
                  </TodayEventBadge>
                  <EventPopover
                    event={e}
                    anchor={popoverAnchors.current[e.id]}
                    isOpen={openPopover === e.id}
                    onClose={() => setOpenPopover(null)}
                  />
                </React.Fragment>
              ))}
              <NewEventBadge isOpen={openPopover === `calendar-day-${heading}`}>
                <span ref={popoverAnchors.current[`calendar-day-${heading}`]} />
              </NewEventBadge>
            </CalendarDay>
            <AddSnoozePopover
              anchor={popoverAnchors.current[`calendar-day-${heading}`]}
              isOpen={openPopover === `calendar-day-${heading}`}
              onClose={() => setOpenPopover(null)}
              initialStartDT={date}
            />
          </>
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

function windowsToDisplayedOccurrences(
  schedule: EventWindow[] | undefined,
  displayedMonthYear: number[],
  weekRows: number[][],
  type?: string
) {
  if (!schedule) return [];
  const [month, year] = displayedMonthYear;
  const firstDisplayedDay = weekRows[0][0];
  const lastDisplayedDay = weekRows[weekRows.length - 1][6];
  const occurrences = schedule
    .map((event, i) => {
      const { rRule, duration, skipRecurrences, id } = event;
      const recurrenceRule = new RRule({
        ...rRule,
        dtstart: new Date(rRule.dtstart),
        until: rRule.until ? new Date(rRule.until) : null,
        byweekday: rRule.byweekday ?? null,
        wkst: rRule.wkst ? Weekday[rRule.wkst] : null,
      });
      const recurrences = recurrenceRule.between(
        moment().month(month).year(year).date(firstDisplayedDay).toDate(),
        moment().month(month).year(year).date(lastDisplayedDay).toDate()
      );
      return recurrences.reduce(
        (result: Array<{ start: string; end: string; title: string; id?: string }>, occurrence) => {
          if (skipRecurrences?.includes(occurrence.toISOString())) return result;
          const start = moment(occurrence).toISOString();
          const end = moment(occurrence).add(duration, 'ms').toISOString();
          const title = event.title ?? 'Snooze';
          const eventId = id ?? `relative-${i}`;
          const recurrenceSummary = scheduleSummary({ ...event, id: eventId });
          return [
            ...result,
            {
              start,
              end,
              id: eventId,
              title,
              allDay: duration >= ONE_DAY_MS,
              recurrenceSummary,
              tzid: event.rRule.tzid,
              type: type ?? (id ? 'scheduledSnooze' : 'relativeSnooze'),
              eventObject: event,
            },
          ];
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
          start: string;
          end: string;
          id?: string;
          isStart: boolean;
          isEnd: boolean;
        }>
      >,
      occurrence
    ) => {
      const startOfMonth = moment([year, month, 1]);
      const startDayIndex = Math.round(
        moment(occurrence.start).hour(0).diff(startOfMonth, 'days', true) + 1
      );
      const endDayIndex = Math.round(
        moment(occurrence.end).hour(0).diff(startOfMonth, 'days', true) + 1
      );
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
  snoozeSchedule?: RuleSnoozeSchedule[];
  ruleId: string;
  requestRefresh: () => void;
}

const RuleContext = React.createContext({
  ruleId: '',
  requestRefresh: () => {},
});

export const RuleScheduleCalendar: React.FC<RuleScheduleCalendarProps> = ({
  wkst = 7,
  snoozeSchedule,
  ruleId,
  requestRefresh,
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
    return windowsToDisplayedOccurrences(
      maintenanceWindows,
      displayedMonthYear,
      weekRows,
      'maintenanceWindow'
    );
  }, [maintenanceWindows, weekRows, displayedMonthYear]);

  const calendarRows = useMemo(
    () =>
      weekRows.map((week, weekIdx) => {
        const [month, year] = displayedMonthYear;

        const days = week.map((d) => {
          const dateMoment = moment().month(month).year(year).date(d).hour(0).minute(0).second(0);
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
            date: dateMoment,
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
    <RuleContext.Provider value={{ ruleId, requestRefresh }}>
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
              <CalendarHeading key={`weekday-heading-${weekday}`}>
                {moment().isoWeekday(weekday).format('ddd')}
              </CalendarHeading>
            ))}
            {calendarRows}
          </CalendarGrid>
        </HeightWrapper>
      </EuiPanel>
    </RuleContext.Provider>
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

const AllDayEventBadge = euiStyled(EuiBadge)<{ $isStart: boolean; $isEnd: boolean }>`
  display: block;
  width: 100%;
  margin: 1px 0;
  margin-inline-start: ${(props) => (props.$isStart ? '8px' : 0)} !important;
  margin-inline-end: ${(props) => (props.$isEnd ? '8px' : 0)};
  cursor: pointer;
  height: 20px !important;
  ${(props) => !props.$isStart && !props.$isEnd && `transform: scaleX(1.02);`}
  ${(props) => props.$isStart && props.$isEnd && `transform: scaleX(0.96);`}
  z-index: 1;
  ${(props) =>
    props.$isStart &&
    !props.$isEnd &&
    `
  z-index: 2;
  & * {
    overflow: visible !important;
  }
`}
`;

const TodayEventBadge = euiStyled(EuiBadge).attrs({ color: 'hollow', iconType: 'dot' })<{
  $isStart: boolean;
  $isEnd: boolean;
  $color: string;
}>`
  display: block;
  width: 100%;
  margin: 1px 0;
  margin-inline-start: ${(props) => (props.$isStart ? '8px' : 0)} !important;
  margin-inline-end: ${(props) => (props.$isEnd ? '8px' : 0)};
  border: none;
  & .euiIcon {
    font-weight: bold;
    color: ${({ $color }) => {
      switch ($color) {
        case 'primary':
          return euiThemeVars.euiColorPrimary;
        case 'accent':
          return euiThemeVars.euiColorAccent;
        default:
          return $color;
      }
    }};
  }
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

const AllDayEventSpacer = euiStyled(EuiSpacer)`
  block-size: 22px;
`;

const NewEventBadge = euiStyled(AllDayEventBadge).attrs({ color: 'primary' })<{ isOpen: boolean }>`
  ${(props) =>
    !props.isOpen &&
    `
    visibility: hidden;
  `}
`;

const useSnoozeSchedulerApi = (onClose: () => void) => {
  const {
    http,
    notifications: { toasts },
  } = useKibana().services;
  const { ruleId, requestRefresh } = useContext(RuleContext);

  const [isLoading, setIsLoading] = useState(false);
  const saveSnoozeSchedule = useCallback(
    async (schedule: RuleSnoozeSchedule) => {
      setIsLoading(true);
      try {
        await snoozeRule({ http, snoozeSchedule: schedule, id: ruleId });
        onClose();
        requestRefresh();
        toasts.addSuccess(SNOOZE_SUCCESS_MESSAGE);
      } catch (e) {
        toasts.addDanger(SNOOZE_FAILED_MESSAGE);
      } finally {
        setIsLoading(false);
      }
    },
    [setIsLoading, http, ruleId, toasts, onClose, requestRefresh]
  );

  const cancelSnoozeSchedules = useCallback(
    async (scheduleIds: string[]) => {
      setIsLoading(true);
      try {
        await unsnoozeRule({ http, scheduleIds, id: ruleId });
        onClose();
        requestRefresh();
        toasts.addSuccess(UNSNOOZE_SUCCESS_MESSAGE);
      } catch (e) {
        toasts.addDanger(SNOOZE_FAILED_MESSAGE);
      } finally {
        setIsLoading(false);
      }
    },
    [setIsLoading, http, ruleId, toasts, onClose, requestRefresh]
  );

  const cancelRelativeSnooze = useCallback(async () => {
    setIsLoading(true);
    onClose();
    try {
      await unsnoozeRule({ http, id: ruleId });
      requestRefresh();
      toasts.addSuccess(UNSNOOZE_SUCCESS_MESSAGE);
    } catch (e) {
      toasts.addDanger(SNOOZE_FAILED_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, http, ruleId, toasts, onClose, requestRefresh]);
  return { isLoading, saveSnoozeSchedule, cancelSnoozeSchedules, cancelRelativeSnooze };
};

const AddSnoozePopover: React.FC<{
  anchor: { current: HTMLElement | null } | null;
  isOpen: boolean;
  onClose: () => void;
  initialStartDT: moment.Moment;
}> = ({ anchor, isOpen, onClose, initialStartDT }) => {
  const { isLoading, saveSnoozeSchedule, cancelSnoozeSchedules } = useSnoozeSchedulerApi(onClose);
  if (!anchor?.current) return null;
  return (
    <EuiWrappingPopover
      anchorPosition="leftCenter"
      button={anchor.current}
      isOpen={isOpen}
      closePopover={onClose}
    >
      <RuleSnoozeScheduler
        isLoading={isLoading}
        initialStartDT={initialStartDT}
        onClose={onClose}
        onSaveSchedule={saveSnoozeSchedule}
        onCancelSchedules={cancelSnoozeSchedules}
        hasTitle
        inPopover
      />
    </EuiWrappingPopover>
  );
};

const EventPopover: React.FC<{
  event: DisplayedOccurrence;
  anchor: { current: HTMLElement | null } | null;
  isOpen: boolean;
  onClose: () => void;
}> = ({ event, anchor, isOpen, onClose }) => {
  const {
    application: { navigateToApp },
  } = useKibana().services;
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const { isLoading, saveSnoozeSchedule, cancelSnoozeSchedules, cancelRelativeSnooze } =
    useSnoozeSchedulerApi(onClose);

  const dateText = useMemo(() => {
    if (!event) return;
    const start = moment(event.start).tz(event.tzid);
    const end = moment(event.end).tz(event.tzid);
    if (event.allDay && start.date() !== end.date()) {
      return `${start.format('MMM D')} - ${end.format('MMM D')}`;
    }
    return `${start.format('dddd, MMM D')}`;
  }, [event]);
  const timeText = useMemo(() => {
    if (!event) return;
    const start = moment(event.start).tz(event.tzid);
    const end = moment(event.end).tz(event.tzid);
    return `${start.format('h:mma')} - ${end.format('h:mma')}`;
  }, [event]);

  const defaultTz = useDefaultTimzezone();
  if (!anchor?.current) return null;
  const body =
    event.type === 'scheduledSnooze' && isSchedulerOpen ? (
      <RuleSnoozeScheduler
        isLoading={isLoading}
        initialSchedule={event?.eventObject}
        onClose={() => setIsSchedulerOpen(false)}
        onSaveSchedule={saveSnoozeSchedule}
        onCancelSchedules={cancelSnoozeSchedules}
        hasTitle
        inPopover
      />
    ) : (
      <>
        <EuiPopoverTitle>{event.title}</EuiPopoverTitle>
        <EuiText size="s">
          <EuiIcon type="calendar" /> {dateText}
        </EuiText>
        <EuiText size="s">
          <EuiIcon type="clock" /> {timeText}
        </EuiText>
        {event.tzid !== defaultTz && (
          <EuiText size="s">
            <EuiIcon type="globe" /> {event.tzid}
          </EuiText>
        )}
        {event.recurrenceSummary && (
          <EuiText size="s">
            <EuiIcon type="refresh" /> {event.recurrenceSummary}
          </EuiText>
        )}
        <EuiPopoverFooter>
          {event.type === 'relativeSnooze' ? (
            <EuiButton onClick={cancelRelativeSnooze} fullWidth size="s" color="danger">
              Cancel snooze
            </EuiButton>
          ) : (
            <EuiButton
              fullWidth
              size="s"
              onClick={
                event.type === 'scheduledSnooze'
                  ? () => setIsSchedulerOpen(true)
                  : event.type === 'maintenanceWindow'
                  ? () =>
                      navigateToApp(APP_ID, {
                        path: generatePath(paths.alerting.maintenanceWindowsEdit, {
                          maintenanceWindowId: event.id,
                        }),
                        deepLinkId: MAINTENANCE_WINDOWS_APP_ID,
                      })
                  : () => {}
              }
            >
              Edit schedule
            </EuiButton>
          )}
        </EuiPopoverFooter>
      </>
    );
  return (
    <EuiWrappingPopover
      anchorPosition="leftCenter"
      button={anchor.current}
      isOpen={isOpen}
      closePopover={onClose}
    >
      {body}
    </EuiWrappingPopover>
  );
};

const MAINTENANCE_WINDOWS_APP_ID = 'maintenanceWindows';
const APP_ID = 'management';

const paths = {
  alerting: {
    maintenanceWindows: `/${MAINTENANCE_WINDOWS_APP_ID}`,
    maintenanceWindowsCreate: '/create',
    maintenanceWindowsEdit: '/edit/:maintenanceWindowId',
  },
};

// eslint-disable-next-line import/no-default-export
export { RuleScheduleCalendar as default };

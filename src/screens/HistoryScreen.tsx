// src/screens/HistoryScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

import {
  AirQualityState,
  getAirQualityColor,
} from '../utils/helpers';

import LoadingSpinner from '../components/LoadingSpinner';
import { espService, EspEvent } from '../services/espService';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type HistoryRangeFilter = 'WEEK' | 'MONTH';

interface DayEventsInfo {
  dateKey: string; // yyyy-mm-dd
  worstState: AirQualityState;
  worstSeverity: number;
  events: EspEvent[];
}

const HistoryScreen: React.FC = () => {
  const [events, setEvents] = useState<EspEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [rangeFilter, setRangeFilter] = useState<HistoryRangeFilter>('MONTH');

  const todayKey = formatDateKey(new Date());

  const fetchEvents = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await espService.getEvents();

      if (!res || res.ok !== true) {
        throw new Error('ESP32 /api/events respondió con error');
      }

      const data = res.data ?? [];

      const safeEvents: EspEvent[] = data.map((e: any) => ({
        id: e.id,
        device_id: e.device_id,
        timestamp: e.timestamp ?? e.created_at ?? null,
        event_type: e.event_type,
        event_code: e.event_code,
        description: e.description,
        air_quality_value: e.air_quality_value,
        air_quality_state: e.air_quality_state,
        severity:
          typeof e.severity === 'number' ? e.severity : null,
        fan_speed: e.fan_speed,
        setpoint: e.setpoint,
      }));

      setEvents(safeEvents);

      if (!selectedDateKey) {
        const hasToday = safeEvents.some(
          (ev) => getEventDateKey(ev) === todayKey,
        );
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedDateKey(hasToday ? todayKey : null);
      } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar eventos desde ESP32');
    } finally {
      setLoading(false);
    }
  }, [selectedDateKey, todayKey]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, [fetchEvents]);

  const eventsByDay: Record<string, DayEventsInfo> = useMemo(() => {
    const map: Record<string, DayEventsInfo> = {};

    for (const ev of events) {
      const dateKey = getEventDateKey(ev);
      if (!dateKey) continue;

      if (!map[dateKey]) {
        map[dateKey] = {
          dateKey,
          worstState: null,
          worstSeverity: 0,
          events: [],
        };
      }

      const sev =
        typeof ev.severity === 'number' ? ev.severity : 0;
      map[dateKey].events.push(ev);

      if (sev >= map[dateKey].worstSeverity) {
        map[dateKey].worstSeverity = sev;
        map[dateKey].worstState =
          (ev.air_quality_state as AirQualityState) ??
          map[dateKey].worstState;
      }
    }

    return map;
  }, [events]);

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth],
  );

  const selectedDayInfo: DayEventsInfo | null = useMemo(() => {
    if (!selectedDateKey) return null;
    return eventsByDay[selectedDateKey] ?? null;
  }, [eventsByDay, selectedDateKey]);

  const rangeEvents = useMemo(() => {
    if (events.length === 0) return [];

    if (rangeFilter === 'MONTH') {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 1);

      return events.filter((ev) => {
        const d = getEventDate(ev);
        if (!d) return false;
        return d >= monthStart && d < monthEnd;
      });
    }

    const baseDate = selectedDateKey
      ? parseDateKey(selectedDateKey)
      : new Date();

    const startOfWeek = getStartOfWeek(baseDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return events.filter((ev) => {
      const d = getEventDate(ev);
      if (!d) return false;
      return d >= startOfWeek && d < endOfWeek;
    });
  }, [events, rangeFilter, currentMonth, selectedDateKey]);

  const handlePrevMonth = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  const handleSelectDay = (dateKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDateKey(dateKey);
  };

  const handleChangeFilter = (filter: HistoryRangeFilter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRangeFilter(filter);
  };

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [currentMonth]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#60a5fa"
        />
      }
    >
      <Text style={styles.header}>Historial de Alertas</Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{capitalize(monthLabel)}</Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekDaysRow}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
            <Text key={d} style={styles.weekDayLabel}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((day) => {
            const isSelected = selectedDateKey === day.dateKey;
            const dayEvents = eventsByDay[day.dateKey];
            const worstState = dayEvents?.worstState ?? null;
            const hasEvents = !!dayEvents && dayEvents.events.length > 0;

            const highlightColor =
              worstState === 'MUY MALA'
                ? '#991b1b'
                : worstState === 'MALA'
                ? '#92400e'
                : hasEvents
                ? '#1e293b'
                : 'transparent';

            const borderColor = isSelected ? '#60a5fa' : 'transparent';

            return (
              <TouchableOpacity
                key={day.dateKey}
                style={[
                  styles.dayCell,
                  { opacity: day.isCurrentMonth ? 1 : 0.35 },
                ]}
                onPress={() => handleSelectDay(day.dateKey)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.dayCircle,
                    {
                      backgroundColor: highlightColor,
                      borderColor,
                    },
                  ]}
                >
                  <Text style={styles.dayNumberText}>{day.day}</Text>
                </View>
                {hasEvents && (
                  <View
                    style={[
                      styles.dayDot,
                      { backgroundColor: getAirQualityColor(worstState) },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Filtro semana/mes para lista de resumen */}
      <View style={styles.filterCard}>
        <Text style={styles.sectionTitle}>Resumen</Text>
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            onPress={() => handleChangeFilter('WEEK')}
            style={[
              styles.segmentButton,
              rangeFilter === 'WEEK' && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                rangeFilter === 'WEEK' && styles.segmentTextActive,
              ]}
            >
              Semana
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleChangeFilter('MONTH')}
            style={[
              styles.segmentButton,
              rangeFilter === 'MONTH' && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                rangeFilter === 'MONTH' && styles.segmentTextActive,
              ]}
            >
              Mes
            </Text>
          </TouchableOpacity>
        </View>

        {rangeEvents.length === 0 ? (
          <Text style={styles.emptyText}>
            No hay eventos en el rango seleccionado.
          </Text>
        ) : (
          rangeEvents.slice(0, 8).map((ev) => {
            const d = getEventDate(ev);
            const dateLabel = d
              ? d.toLocaleDateString(undefined, {
                  day: '2-digit',
                  month: 'short',
                })
              : '--';
            const timeLabel = d
              ? d.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '--';

            const state = (ev.air_quality_state ??
              'MALA') as AirQualityState;
            const color = getAirQualityColor(state);

            return (
              <View key={String(ev.id) + timeLabel} style={styles.summaryItem}>
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryDate}>{dateLabel}</Text>
                  <Text style={styles.summaryTime}>{timeLabel}</Text>
                </View>
                <View style={styles.summaryContent}>
                  <Text style={[styles.summaryState, { color }]}>
                    {state ?? 'MALA'}
                  </Text>
                  <Text style={styles.summaryDesc} numberOfLines={1}>
                    {ev.description ?? 'Alerta de calidad de aire'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Lista detallada del día seleccionado */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Eventos del día</Text>
        {selectedDayInfo == null || selectedDayInfo.events.length === 0 ? (
          <Text style={styles.emptyText}>
            Selecciona un día con eventos en el calendario.
          </Text>
        ) : (
          selectedDayInfo.events.map((ev) => {
            const d = getEventDate(ev);
            const timeLabel = d
              ? d.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '--';

            const state = (ev.air_quality_state ??
              'MALA') as AirQualityState;
            const color = getAirQualityColor(state);

            return (
              <View
                key={String(ev.id) + timeLabel + '_detail'}
                style={styles.eventItem}
              >
                <View
                  style={[styles.eventStateDot, { backgroundColor: color }]}
                />
                <View style={styles.eventTextBlock}>
                  <Text style={styles.eventTime}>{timeLabel}</Text>
                  <Text style={[styles.eventState, { color }]}>
                    {state}
                  </Text>
                  <Text style={styles.eventDesc} numberOfLines={2}>
                    {ev.description ?? 'Alerta registrada'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {loading && (
        <View style={{ marginTop: 12 }}>
          <LoadingSpinner />
        </View>
      )}
    </ScrollView>
  );
};

export default HistoryScreen;

// ===================== helpers de fecha =====================

function getEventDate(ev: EspEvent): Date | null {
  const t = ev.timestamp ?? (ev as any).created_at;
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getEventDateKey(ev: EspEvent): string | null {
  const d = getEventDate(ev);
  return d ? formatDateKey(d) : null;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

function getStartOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0=Dom,1=Lun,...6=Sab
  const diff = day === 0 ? -6 : 1 - day; // ajustar a lunes
  date.setDate(date.getDate() + diff);
  return date;
}

interface CalendarDay {
  date: Date;
  dateKey: string;
  day: number;
  isCurrentMonth: boolean;
}

function buildCalendarDays(month: Date): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);

  const firstWeekDay = firstOfMonth.getDay(); // 0=Dom,...6=Sab
  const offsetToMonday = firstWeekDay === 0 ? 6 : firstWeekDay - 1;

  const daysInMonth = lastOfMonth.getDate();

  const days: CalendarDay[] = [];

  for (let i = offsetToMonday; i > 0; i--) {
    const d = new Date(year, monthIndex, 1 - i);
    days.push({
      date: d,
      dateKey: formatDateKey(d),
      day: d.getDate(),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    days.push({
      date: d,
      dateKey: formatDateKey(d),
      day,
      isCurrentMonth: true,
    });
  }

  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    const d = new Date(
      last.getFullYear(),
      last.getMonth(),
      last.getDate() + 1,
    );
    days.push({
      date: d,
      dateKey: formatDateKey(d),
      day: d.getDate(),
      isCurrentMonth: false,
    });
  }

  return days;
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020817',
  },
  content: {
    padding: 16,
    paddingBottom: 64,
  },
  header: {
    fontSize: 22,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 13,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  monthBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#60a5fa',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekDayLabel: {
    width: 35,
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: '13.6%',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumberText: {
    fontSize: 12,
    color: '#e5e7eb',
    fontWeight: '600',
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 10,
  },
  filterCard: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#111827',
    padding: 4,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: '#3b82f6',
  },
  segmentText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 12,
    paddingVertical: 6,
  },
  summaryItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomColor: '#1f2937',
    borderBottomWidth: 1,
  },
  summaryBadge: {
    width: 46,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryDate: {
    fontSize: 11,
    color: '#e5e7eb',
    fontWeight: '600',
  },
  summaryTime: {
    fontSize: 10,
    color: '#9ca3af',
  },
  summaryContent: {
    flex: 1,
  },
  summaryState: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryDesc: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  eventItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomColor: '#1f2937',
    borderBottomWidth: 1,
  },
  eventStateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
    marginTop: 4,
  },
  eventTextBlock: {
    flex: 1,
  },
  eventTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  eventState: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  eventDesc: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
});

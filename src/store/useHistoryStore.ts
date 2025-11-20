import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import { DEVICE_UUID } from '../utils/device';

export type HistoryRange = '24h' | '7d' | '30d';

interface HistoryState {
  range: HistoryRange;
  data: { x: Date; y: number }[];
  avg: number | null;
  diffPercent: number | null;
  loading: boolean;
  error: string | null;

  setRange: (range: HistoryRange) => void;
  fetchHistory: (range?: HistoryRange) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  range: '24h',
  data: [],
  avg: null,
  diffPercent: null,
  loading: false,
  error: null,

  setRange: (range) => {
    set({ range });
    get().fetchHistory(range);
  },

  fetchHistory: async (range = get().range) => {
    set({ loading: true, error: null });
    try {
      const now = new Date();
      const since =
        range === '24h'
          ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
          : range === '7d'
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('measurements')
        .select('timestamp, air_quality_value')
        .eq('device_id', DEVICE_UUID)
        .gte('timestamp', since.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const points =
        data?.map((row) => ({
          x: new Date(row.timestamp),
          y: row.air_quality_value,
        })) ?? [];

      let avg: number | null = null;
      let diffPercent: number | null = null;

      if (points.length > 1) {
        const first = points[0].y;
        const last = points[points.length - 1].y;
        avg =
          points.reduce((s, p) => s + p.y, 0) / points.length;
        diffPercent = first !== 0 ? ((last - first) / first) * 100 : 0;
      }

      set({
        data: points,
        avg,
        diffPercent,
        loading: false,
      });
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },
}));

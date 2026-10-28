import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactElement, ReactNode } from 'react';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import PaymentHistoryScreen from '@/app/(app)/(settings)/payment-history';
import { DashboardApiError, fetchPaymentHistory } from '@/lib/dashboard-api';
import { EARNINGS_PERIOD_KEYS, fetchShopEarnings, zeroEarningsPeriodStats } from '@/lib/earnings-api';

jest.mock('@/lib/dashboard-api', () => {
  const actual = jest.requireActual<typeof import('@/lib/dashboard-api')>('@/lib/dashboard-api');
  return {
    DashboardApiError: actual.DashboardApiError,
    fetchPaymentHistory: jest.fn(),
  };
});

jest.mock('@/lib/earnings-api', () => {
  const actual = jest.requireActual<typeof import('@/lib/earnings-api')>('@/lib/earnings-api');
  return {
    EARNINGS_PERIOD_KEYS: actual.EARNINGS_PERIOD_KEYS,
    fetchShopEarnings: jest.fn(),
    zeroEarningsPeriodStats: actual.zeroEarningsPeriodStats,
  };
});

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { back: jest.fn(), push: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [cb]);
    },
  };
});

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'Icon',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-native/Libraries/Lists/VirtualizedList', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      data,
      renderItem,
      ListHeaderComponent,
      ListEmptyComponent,
      keyExtractor,
    }: {
      data: unknown[] | null;
      renderItem: (info: { item: unknown; index: number }) => ReactElement;
      ListHeaderComponent?: ReactElement | (() => ReactElement);
      ListEmptyComponent?: ReactElement | (() => ReactElement);
      keyExtractor?: (item: unknown, index: number) => string;
    }) => {
      const rows = data ?? [];
      const header =
        typeof ListHeaderComponent === 'function'
          ? ListHeaderComponent()
          : ListHeaderComponent;
      const empty =
        rows.length === 0 && ListEmptyComponent
          ? typeof ListEmptyComponent === 'function'
            ? ListEmptyComponent()
            : ListEmptyComponent
          : null;
      return React.createElement(
        View,
        null,
        header,
        empty,
        ...rows.map((item, index) =>
          React.createElement(
            View,
            { key: keyExtractor ? keyExtractor(item, index) : String(index) },
            renderItem({ item, index }),
          ),
        ),
      );
    },
  };
});

const mockFetchPaymentHistory = fetchPaymentHistory as jest.MockedFunction<typeof fetchPaymentHistory>;
const mockFetchShopEarnings = fetchShopEarnings as jest.MockedFunction<typeof fetchShopEarnings>;

function buildPeriods(net: number) {
  const stats = { ...zeroEarningsPeriodStats(), received: net, net };
  return Object.fromEntries(EARNINGS_PERIOD_KEYS.map((key) => [key, { ...stats }]));
}

function collectText(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .map((node) => {
      const child = node.props.children;
      if (typeof child === 'string') return child;
      if (Array.isArray(child)) {
        return child.filter((part): part is string => typeof part === 'string').join('');
      }
      return '';
    })
    .filter((value) => value.length > 0);
}

async function flushAsyncUpdates() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderScreen() {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<PaymentHistoryScreen />);
  });
  await flushAsyncUpdates();
  return tree;
}

describe('PaymentHistoryScreen earnings and history independence', () => {
  beforeEach(() => {
    mockFetchPaymentHistory.mockReset();
    mockFetchShopEarnings.mockReset();
  });

  it('shows earnings net and history retry when history fails and earnings succeeds', async () => {
    mockFetchShopEarnings.mockResolvedValue({
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      asOf: new Date('2026-10-29T10:00:00+05:30'),
      periods: buildPeriods(1200) as never,
      refundsDue: { count: 0, amount: 0 },
    });
    mockFetchPaymentHistory.mockRejectedValue(
      new DashboardApiError('server', 500, 'INTERNAL_ERROR'),
    );

    const tree = await renderScreen();
    const text = collectText(tree).join(' ');

    expect(text).toContain('Net earned');
    expect(text).toContain('Retry');
    expect(text).toContain('Could not load payment history');
  });

  it('shows earnings net and empty history copy when history is empty', async () => {
    mockFetchShopEarnings.mockResolvedValue({
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      asOf: new Date('2026-10-29T10:00:00+05:30'),
      periods: buildPeriods(500) as never,
      refundsDue: { count: 0, amount: 0 },
    });
    mockFetchPaymentHistory.mockResolvedValue([]);

    const tree = await renderScreen();
    const text = collectText(tree).join(' ');

    expect(text).toContain('Net earned');
    expect(text).toContain('No payments yet');
  });
});

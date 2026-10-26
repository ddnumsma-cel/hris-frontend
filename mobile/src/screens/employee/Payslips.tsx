import { formatDate, formatPHP, type PayslipView } from '@msma/shared';
import { View } from 'react-native';
import { Badge, Card, ErrorText, Loading, mono, Screen, SectionTitle, T } from '~/components/ui';
import { useLatestPayslip } from '~/lib/queries';
import { useTheme } from '~/lib/theme';

function Line({
  label,
  value,
  strong,
  negative,
  first,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
  /** The card's first line has no divider above it. */
  first?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
      }}
    >
      <T weight={strong ? '600' : undefined}>{label}</T>
      <T weight={strong ? '700' : '500'} style={mono}>
        {negative && value !== '0.00' ? '-' : ''}
        {formatPHP(value)}
      </T>
    </View>
  );
}

const earnings = (p: PayslipView) =>
  [
    ['Basic pay', p.basicPay],
    ['Overtime', p.overtimePay],
    ['Night differential', p.nightDiffPay],
    ['Holiday pay', p.holidayPay],
  ] as const;

const deductions = (p: PayslipView) =>
  [
    ['SSS', p.sss],
    ['PhilHealth', p.philhealth],
    ['Pag-IBIG', p.pagibig],
    ['Withholding tax', p.withholdingTax],
  ] as const;

export default function PayslipsScreen() {
  const { c } = useTheme();
  const q = useLatestPayslip();
  const p = q.data;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <ErrorText error={q.error} onRetry={() => q.refetch()} />
      {q.isLoading && <Loading />}
      {p && (
        <>
          <Card tone="accent">
            <T muted size={13}>
              Latest payslip · {p.label}
            </T>
            <T muted size={13}>
              Net pay
            </T>
            <T size={34} weight="700" style={[mono, { color: c.accent }]}>
              {formatPHP(p.netPay)}
            </T>
            <T muted size={13}>
              Released {formatDate(p.payDate)} · {p.daysPaid} days paid
            </T>
          </Card>
          <Badge
            label="SAMPLE: rates not yet verified"
            tone="warning"
            icon="alert-circle-outline"
          />

          <SectionTitle>Earnings</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {earnings(p).map(([label, value], i) => (
              <Line key={label} label={label} value={value} first={i === 0} />
            ))}
            <Line label="Late / undertime" value={p.lateUndertimeDeduction} negative />
            <Line label="Gross pay" value={p.grossPay} strong />
          </Card>

          <SectionTitle>Deductions</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {deductions(p).map(([label, value], i) => (
              <Line key={label} label={label} value={value} first={i === 0} />
            ))}
            <Line label="Total deductions" value={p.totalDeductions} strong />
          </Card>

          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T weight="700" size={17}>
                Net pay
              </T>
              <T weight="700" size={17} style={mono}>
                {formatPHP(p.netPay)}
              </T>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

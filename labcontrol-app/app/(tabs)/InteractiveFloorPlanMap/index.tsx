import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// ============================================================================
// COLORS & DESIGN SYSTEM
// ============================================================================

const colors = {
  slate900: '#0F172A',
  slate700: '#334155',
  slate600: '#475569',
  slate400: '#94A3B8',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  white: '#FFFFFF',
  blue: '#2563EB',
  blueLight: '#DBEAFE',
  green: '#10B981',
  greenLight: '#D1FAE5',
  red: '#EF4444',
  redLight: '#FEE2E2',
  orange: '#F97316',
  orangeLight: '#FFEDD5',
  purple: '#9C27B0',
  purpleLight: '#F3E5F5',
  pink: '#FF6B9D',
  pinkLight: '#FFE0E6',
  gray: '#F3F4F6',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};



// ============================================================================
// HEADER COMPONENT
// ============================================================================

interface HeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, onBack }) => (
  <View style={styles.header}>
    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={onBack}>
      <Ionicons name="arrow-back" size={24} color={colors.slate900} />
    </TouchableOpacity>

    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerSubtitle}>{subtitle}</Text>
    </View>
  </View>
);

// ============================================================================
// ZONE CARD COMPONENT
// ============================================================================

interface ZoneCardProps {
  type: 'ok' | 'alert' | 'active';
  mainText: string;
  secondaryText?: string;
  tertiaryText?: string;
}

const ZoneCard: React.FC<ZoneCardProps> = ({
  type,
  mainText,
  secondaryText,
  tertiaryText,
}) => {
  const getStyle = () => {
    switch (type) {
      case 'ok':
        return { borderColor: colors.green, backgroundColor: colors.greenLight };
      case 'alert':
        return { borderColor: colors.red, backgroundColor: colors.redLight };
      case 'active':
        return { borderColor: colors.blue, backgroundColor: colors.blueLight };
      default:
        return {};
    }
  };

  return (
    <View style={[styles.zoneCard, getStyle()]}>
      {type === 'alert' && (
        <View style={styles.alertTag}>
          <Text style={styles.alertTagText}>High Temp</Text>
        </View>
      )}
      <Text style={styles.zoneCardMain}>{mainText}</Text>
      {secondaryText && (
        <Text style={styles.zoneCardSecondary}>{secondaryText}</Text>
      )}
      {tertiaryText && (
        <Text style={styles.zoneCardTertiary}>{tertiaryText}</Text>
      )}
    </View>
  );
};

// ============================================================================
// ZONES GRID
// ============================================================================

const ZonesGrid: React.FC = () => (
  <View style={styles.zonesGrid}>
    <ZoneCard type="ok" mainText="3/5" />
    <ZoneCard
      type="alert"
      mainText="404"
      secondaryText="Filter Check"
    />
    <ZoneCard
      type="active"
      mainText="22°C"
      tertiaryText="4.2kW"
    />
  </View>
);

// ============================================================================
// LAB STATUS HEADER
// ============================================================================

const LabStatusHeader: React.FC = () => (
  <View style={styles.labStatusContainer}>
    <View>
      <View style={styles.labHeaderTop}>
        <Text style={styles.labTitle}>Lab 402: Bio-Safety</Text>
        <View style={styles.badgeNormal}>
          <Text style={styles.badgeNormalText}>NORMAL</Text>
        </View>
      </View>
      <Text style={styles.labSubtitle}>Zone B · Critical Infrastructure</Text>
    </View>
  </View>
);

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  subtitle: string;
  iconBg: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  subtitle,
  iconBg,
}) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIconBox, { backgroundColor: iconBg }]}>
      <MaterialIcons name={icon as any} size={20} color={colors.white} />
    </View>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricSubtitle}>{subtitle}</Text>
  </View>
);

// ============================================================================
// METRICS GRID
// ============================================================================

const MetricsGrid: React.FC = () => (
  <View style={styles.metricsGrid}>
    <MetricCard
      icon="thermostat"
      label="Temperature"
      value="22.4°C"
      subtitle="Target 22°"
      iconBg="#FF6B6B"
    />
    <MetricCard
      icon="water-drop"
      label="Humidity"
      value="45%"
      subtitle="Stable"
      iconBg="#FFB84D"
    />
    <MetricCard
      icon="people"
      label="Occupancy"
      value="4/8"
      subtitle="Active"
      iconBg="#9C27B0"
    />
    <MetricCard
      icon="air"
      label="Air Quality"
      value="412"
      subtitle="Good"
      iconBg="#FF6B9D"
    />
  </View>
);

export default function InteractiveFloorPlanMap() {
  const params = useLocalSearchParams<{ labName?: string; labStatus?: string; labDetail?: string }>();
  const router = useRouter();
  const labName = typeof params.labName === 'string' ? params.labName : 'Lab 402';
  const labStatus = typeof params.labStatus === 'string' ? params.labStatus : 'NORMAL';
  const labDetail = typeof params.labDetail === 'string' ? params.labDetail : 'Zone B · Critical Infrastructure';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <Header title={labName} subtitle={labDetail} onBack={() => router.push('/Labs')} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.visualizationShell}>
          <ZonesGrid />
          <LabStatusHeader />
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>STATUS</Text>
              <Text style={styles.statusPillValue}>{labStatus}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>LAB</Text>
              <Text style={styles.statusPillValue}>{labName}</Text>
            </View>
          </View>
          <MetricsGrid />
          <View style={{ height: spacing.lg }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },

  headerCenter: {
    flex: 1,
    marginHorizontal: spacing.md,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate900,
    lineHeight: 20,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.slate600,
    marginTop: 2,
    textAlign: 'center',
  },

  // SCROLL VIEW
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },

  visualizationShell: {
    alignItems: 'center',
  },

  // ZONES GRID
  zonesGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },

  zoneCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    minHeight: 100,
    justifyContent: 'center',
  },

  zoneCardMain: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.slate900,
    marginBottom: spacing.xs,
  },

  zoneCardSecondary: {
    fontSize: 11,
    color: colors.slate600,
    marginBottom: spacing.xs,
  },

  zoneCardTertiary: {
    fontSize: 10,
    color: colors.slate600,
  },

  alertTag: {
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },

  alertTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.red,
  },

  // LAB STATUS
  labStatusContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },

  labHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
    justifyContent: 'center',
  },

  labTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },

  badgeNormal: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.greenLight,
  },

  badgeNormalText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.green,
  },

  labSubtitle: {
    fontSize: 12,
    color: colors.slate600,
    textAlign: 'center',
  },

  statusRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
    justifyContent: 'center',
  },

  statusPill: {
    flex: 1,
    maxWidth: 150,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
    alignItems: 'center',
  },

  statusPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.slate600,
    letterSpacing: 0.6,
    marginBottom: 2,
  },

  statusPillValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate900,
    textAlign: 'center',
  },

  // METRICS
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
    justifyContent: 'center',
  },

  metricCard: {
    width: (width - spacing.lg * 2 - spacing.md) / 2,
    backgroundColor: colors.slate100,
    borderRadius: radius.lg,
    padding: spacing.md,
  },

  metricIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  metricLabel: {
    fontSize: 10,
    color: colors.slate600,
    fontWeight: '500',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
    marginBottom: spacing.xs,
    lineHeight: 22,
  },

  metricSubtitle: {
    fontSize: 10,
    color: colors.slate600,
  },


});

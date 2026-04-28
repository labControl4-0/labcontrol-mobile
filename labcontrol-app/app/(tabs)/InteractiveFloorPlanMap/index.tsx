import React, { useState } from 'react';
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

const Header: React.FC = () => (
  <View style={styles.header}>
    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="arrow-back" size={24} color={colors.slate900} />
    </TouchableOpacity>

    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle}>Floor 4 - Research Lab</Text>
      <Text style={styles.headerSubtitle}>Building A · West Wing</Text>
    </View>

    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <MaterialIcons name="settings" size={24} color={colors.slate900} />
    </TouchableOpacity>
  </View>
);

// ============================================================================
// TAB CHIP COMPONENT
// ============================================================================

interface TabChipProps {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}

const TabChip: React.FC<TabChipProps> = ({ label, active, badge, onPress }) => (
  <TouchableOpacity
    style={[styles.tabChip, active && styles.tabChipActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
      {label}
    </Text>
    {badge !== undefined && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    )}
  </TouchableOpacity>
);

// ============================================================================
// TABS SECTION
// ============================================================================

interface TabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.tabsContainer}
    contentContainerStyle={styles.tabsContent}
    scrollEventThrottle={16}
  >
    <TabChip
      label="All Zones"
      active={activeTab === 'zones'}
      onPress={() => onTabChange('zones')}
    />
    <TabChip
      label="Alerts"
      active={activeTab === 'alerts'}
      badge={2}
      onPress={() => onTabChange('alerts')}
    />
    <TabChip
      label="Occupancy"
      active={activeTab === 'occupancy'}
      onPress={() => onTabChange('occupancy')}
    />
    <TabChip
      label="Energy"
      active={activeTab === 'energy'}
      onPress={() => onTabChange('energy')}
    />
  </ScrollView>
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
    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <MaterialIcons name="more-vert" size={20} color={colors.slate600} />
    </TouchableOpacity>
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

// ============================================================================
// ACTION BUTTON
// ============================================================================

interface ActionButtonProps {
  label: string;
  onPress?: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
}) => (
  <TouchableOpacity
    style={styles.actionButton}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <MaterialIcons name="tune" size={18} color={colors.white} style={{ marginRight: 8 }} />
    <Text style={styles.actionButtonText}>{label}</Text>
  </TouchableOpacity>
);

// ============================================================================
// BOTTOM NAVIGATION
// ============================================================================

interface BottomNavProps {
  activeIcon: string;
  onNavigate: (icon: string) => void;
}

const BottomNavigation: React.FC<BottomNavProps> = ({ activeIcon, onNavigate }) => {
  const navItems = [
    { icon: 'home', id: 'home' },
    { icon: 'map', id: 'map', active: true },
    { icon: 'assessment', id: 'assessment' },
    { icon: 'notifications', id: 'notifications', badge: true },
    { icon: 'person', id: 'person' },
  ];

  return (
    <View style={styles.bottomNav}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.bottomNavItem}
          onPress={() => onNavigate(item.id)}
        >
          <View style={styles.navItemContent}>
            <MaterialIcons
              name={item.icon as any}
              size={24}
              color={activeIcon === item.id ? colors.blue : colors.slate400}
            />
            {item.badge && <View style={styles.navBadge} />}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function InteractiveFloorPlanMap() {
  const [activeTab, setActiveTab] = useState('zones');
  const [activeNav, setActiveNav] = useState('map');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <Header />
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <ZonesGrid />
        <LabStatusHeader />
        <MetricsGrid />
        <ActionButton label="Adjust Environment Settings" />
        <View style={{ height: spacing.lg }} />
      </ScrollView>

      <BottomNavigation activeIcon={activeNav} onNavigate={setActiveNav} />
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
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate900,
    lineHeight: 20,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.slate600,
    marginTop: 2,
  },

  // TABS
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    flexGrow: 0,
  },

  tabsContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },

 tabChip: {
    height: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: 6, // 🔽 diminui aqui
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
},

  tabChipActive: {
    backgroundColor: colors.slate900,
  },

  tabChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.slate700,
  },

  tabChipTextActive: {
    color: colors.white,
  },

  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.red,
    minWidth: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
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

  // ZONES GRID
  zonesGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  },

  // METRICS
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
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

  // ACTION BUTTON
  actionButton: {
    backgroundColor: colors.blue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: colors.blue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  actionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // BOTTOM NAVIGATION
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  bottomNavItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  navItemContent: {
    position: 'relative',
  },

  navBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.red,
  },
});

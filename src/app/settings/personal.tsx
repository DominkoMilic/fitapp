import { useState } from 'react';
import { View } from 'react-native';

import { ErrorState, LoadingState } from '@/components/feedback';
import { Button, Screen, SegmentedControl, Text, TextField } from '@/components/ui';
import {
  ACTIVITY_DESCRIPTIONS,
  ACTIVITY_LEVELS,
  type ActivityLevel,
} from '@/domain/calculations/energy';
import { personalSchema } from '@/domain/validation/onboarding';
import { useToday } from '@/features/dashboard/useToday';
import { DateField } from '@/features/onboarding/components/DateField';
import { HeightField } from '@/features/onboarding/components/MeasurementFields';
import { OptionCard } from '@/features/onboarding/components/OptionCard';
import { useProfile, useUpdateProfile, type Profile } from '@/features/profile/api';
import { SaveState } from '@/features/profile/SaveState';
import { spacing } from '@/theme';
import { yearsBefore } from '@/domain/calculations/calendar';

export default function PersonalSettings() {
  const profile = useProfile();
  if (profile.isPending)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <ErrorState
          message="We couldn't load your profile."
          onRetry={() => void profile.refetch()}
        />
      </Screen>
    );
  }
  return <PersonalForm profile={profile.data} />;
}

function PersonalForm({ profile }: { profile: Profile }) {
  const { today } = useToday();
  const update = useUpdateProfile();
  const [values, setValues] = useState({
    displayName: profile.display_name ?? '',
    dateOfBirth: profile.date_of_birth ?? '',
    calcSex: profile.calc_sex as 'male' | 'female',
    heightCm: profile.height_cm ?? 0,
    unitSystem: profile.unit_system as 'metric' | 'imperial',
    timezone: profile.timezone,
    activityLevel: (profile.activity_level ?? 'moderate') as ActivityLevel,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    // weightKg is not edited here; pass a valid placeholder to reuse the shared schema.
    const parsed = personalSchema(today).safeParse({ ...values, weightKg: 70 });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    update.mutate({
      display_name: values.displayName.trim(),
      date_of_birth: values.dateOfBirth,
      calc_sex: values.calcSex,
      height_cm: Math.round(values.heightCm * 10) / 10,
      unit_system: values.unitSystem,
      timezone: values.timezone,
      activity_level: values.activityLevel,
    });
  };

  return (
    <Screen
      locked={update.isPending}
      edges={['bottom']}
      footer={<Button title="Save" loading={update.isPending} onPress={save} />}
    >
      <SaveState status={update.status} error={update.error} />
      <TextField
        label="Name"
        value={values.displayName}
        onChangeText={(displayName) => setValues({ ...values, displayName })}
        error={errors.displayName}
      />
      <DateField
        label="Date of birth"
        max={yearsBefore(today, 18)}
        min={yearsBefore(today, 100)}
        startOnYears
        value={values.dateOfBirth || null}
        onChange={(d) => setValues({ ...values, dateOfBirth: d ?? '' })}
        error={errors.dateOfBirth}
      />
      <Text variant="small" color="textSecondary">
        Sex
      </Text>
      <SegmentedControl
        accessibilityLabel="Sex"
        options={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ]}
        value={values.calcSex}
        onChange={(calcSex) => setValues({ ...values, calcSex })}
      />
      <SegmentedControl
        accessibilityLabel="Units"
        options={[
          { value: 'metric', label: 'kg · cm · km' },
          { value: 'imperial', label: 'lb · ft · mi' },
        ]}
        value={values.unitSystem}
        onChange={(unitSystem) => setValues({ ...values, unitSystem })}
      />
      <HeightField
        key={values.unitSystem}
        unitSystem={values.unitSystem}
        value={values.heightCm}
        onChange={(cm) => setValues({ ...values, heightCm: cm ?? 0 })}
        error={errors.heightCm}
      />
      <TextField
        label="Timezone"
        hint="IANA name, e.g. Europe/Zagreb. Existing entries keep their dates."
        value={values.timezone}
        autoCapitalize="none"
        onChangeText={(timezone) => setValues({ ...values, timezone })}
        error={errors.timezone}
      />
      <Text variant="small" color="textSecondary">
        Activity level
      </Text>
      <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup">
        {ACTIVITY_LEVELS.map((level) => (
          <OptionCard
            key={level}
            title={ACTIVITY_DESCRIPTIONS[level].title}
            description={ACTIVITY_DESCRIPTIONS[level].description}
            selected={values.activityLevel === level}
            onPress={() => setValues({ ...values, activityLevel: level })}
          />
        ))}
      </View>
    </Screen>
  );
}

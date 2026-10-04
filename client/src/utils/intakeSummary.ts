type Disease = 'heart' | 'diabetes' | 'lung'
type IntakeValues = Record<string, string | number>

const display = (value: string | number | undefined, fallback = 'not provided') =>
  value === undefined ? fallback : String(value)

export function summarizeIntake(disease: Disease, input: IntakeValues, derived: Record<string, number>) {
  const identity = `Age ${display(input.age)}; gender ${display(input.gender)}.`

  if (disease === 'heart') {
    return [
      identity,
      `Height ${display(input.heightCm)} cm; weight ${display(input.weightKg)} kg; calculated BMI ${display(derived.bmi)}.`,
      `Recorded blood pressure ${display(input.systolicBloodPressure)}/${display(input.diastolicBloodPressure)} mmHg. Cholesterol: total ${display(input.totalCholesterol)}, LDL ${display(input.ldlCholesterol)}, HDL ${display(input.hdlCholesterol)}, and triglycerides ${display(input.triglycerides)} mg/dL. Blood glucose ${display(input.bloodGlucose)} mg/dL.`,
      `You entered diabetes: ${display(input.diabetes)}; smoking: ${display(input.smokingHabit)}; alcohol: ${display(input.alcoholHabit)}; weekly exercise: ${display(input.weeklyExerciseMinutes)} minutes; family history of heart disease: ${display(input.familyHistoryOfHeartDisease)}; previous heart disease: ${display(input.previousHeartDisease)}.`,
    ].join(' ')
  }

  if (disease === 'diabetes') {
    return [
      identity,
      `Height ${display(input.heightCm)} cm; weight ${display(input.weightKg)} kg; calculated BMI ${display(derived.bmi)}.`,
      `Fasting blood glucose ${display(input.fastingBloodGlucose)} mg/dL; HbA1c ${display(input.hba1c)}%; recorded blood pressure ${display(input.systolicBloodPressure)}/${display(input.diastolicBloodPressure)} mmHg.`,
      `You entered family history of diabetes: ${display(input.familyHistoryOfDiabetes)}; previous prediabetes: ${display(input.previousPrediabetes)}; weekly exercise: ${display(input.weeklyExerciseMinutes)} minutes; smoking: ${display(input.smokingHabit)}; alcohol: ${display(input.alcoholHabit)}; diet quality: ${display(input.dietQuality)}; sugary drinks: ${display(input.sugaryDrinksConsumption)}; gestational diabetes history: ${display(input.gestationalDiabetesHistory)}; PCOS: ${display(input.pcos)}.`,
    ].join(' ')
  }

  return [
    identity,
    `Smoking status ${display(input.smokingStatus)}; ${display(input.cigarettesPerDay)} cigarettes per day for ${display(input.yearsOfSmoking)} years; calculated ${display(derived.packYears)} pack-years.`,
    `You entered secondhand smoke exposure: ${display(input.secondhandSmokeExposure)}; workplace exposure: ${display(input.workplaceExposure)}; asbestos exposure: ${display(input.asbestosExposure)}; radon exposure: ${display(input.radonExposure)}; air-pollution exposure: ${display(input.airPollutionExposure)}.`,
    `You entered chronic lung disease: ${display(input.chronicLungDisease)}; family history of lung cancer: ${display(input.familyHistoryOfLungCancer)}; previous cancer: ${display(input.previousCancerHistory)}; previous chest radiation: ${display(input.previousChestRadiation)}; persistent cough: ${display(input.persistentCough)}; shortness of breath: ${display(input.shortnessOfBreath)}; chest pain: ${display(input.chestPain)}.`,
  ].join(' ')
}

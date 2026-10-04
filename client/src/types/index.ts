export interface User {
  id: string
  fullName: string
  email: string
  createdAt: string
}

export interface DashboardSummary {
  counts: {
    predictions: number
    intakes: number
    conversations: number
    medicalFiles: number
  }
}

export interface Prediction {
  id: string
  disease: 'heart' | 'diabetes' | 'lung'
  inputData: Record<string, string | number>
  riskPercentage: number
  modelVersion: string
  createdAt: string
  chatSessionId?: string | null
  fileCount?: number
}

export interface ClinicalIntake {
  id: string
  disease: 'heart' | 'diabetes' | 'lung'
  inputData: Record<string, string | number>
  derivedData: Record<string, number>
  riskPercentage: number | null
  riskLevel: 'Low' | 'Medium' | 'High' | null
  modelVersion: string | null
  modelStatus: string
  createdAt: string
  chatSessionId: string | null
  fileCount: number
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  message: string
  attachment_id?: string | null
  attachment_name?: string | null
  created_at: string
}

export interface MedicalFile {
  id: string
  original_filename: string
  file_type: string
  file_size: number
  analysis: { text: string; analyzedAt: string } | null
  created_at: string
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

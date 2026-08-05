export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  phone: string;
  allergies: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  time: string;
  reason: string;
  status: "Waiting" | "In consult" | "Done";
}

export const SEED_PATIENTS: Patient[] = [
  { id: "PT-1041", name: "Ananya Sharma", age: 32, gender: "Female", phone: "+91 98200 11223", allergies: "Penicillin" },
  { id: "PT-1042", name: "Rohit Verma", age: 45, gender: "Male", phone: "+91 98111 44556", allergies: "None known" },
  { id: "PT-1043", name: "Meera Iyer", age: 27, gender: "Female", phone: "+91 99001 22334", allergies: "Sulfa drugs" },
  { id: "PT-1044", name: "Imran Qureshi", age: 58, gender: "Male", phone: "+91 90045 66778", allergies: "None known" },
  { id: "PT-1045", name: "Kavya Nair", age: 8, gender: "Female", phone: "+91 97600 88991", allergies: "Peanuts" },
  { id: "PT-1046", name: "Sanjay Gupta", age: 63, gender: "Male", phone: "+91 98300 55667", allergies: "Aspirin" },
];

export const SEED_APPOINTMENTS: Appointment[] = [
  { id: "A1", patientId: "PT-1041", time: "09:30 AM", reason: "Fever & sore throat", status: "Waiting" },
  { id: "A2", patientId: "PT-1045", time: "10:00 AM", reason: "Persistent cough", status: "Waiting" },
  { id: "A3", patientId: "PT-1042", time: "10:45 AM", reason: "BP follow-up", status: "In consult" },
  { id: "A4", patientId: "PT-1046", time: "11:30 AM", reason: "Diabetes review", status: "Waiting" },
  { id: "A5", patientId: "PT-1043", time: "12:15 PM", reason: "Skin allergy", status: "Done" },
];

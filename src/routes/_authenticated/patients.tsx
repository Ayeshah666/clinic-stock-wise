import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  FieldError,
  LoadingRows,
  PageHeader,
  Panel,
  TableWrap,
} from "@/components/pharmacy-ui";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDate,
  getMedicines,
  getPatients,
  getPrescriptions,
  medicineLabel,
  qk,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/patients")({
  head: () => ({
    meta: [
      { title: "Patients & Prescriptions — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Register clinic patients and record doctor prescriptions before dispensing medicines.",
      },
      { property: "og:title", content: "Patients & Prescriptions — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Patient register and prescription records for the clinic pharmacy.",
      },
    ],
  }),
  component: PatientsPage,
});

interface PatientRow {
  id: string;
  code: string;
  name: string;
  contact_number: string | null;
  gender: string | null;
  age: number | null;
  clinic_reference: string | null;
  is_active: boolean;
}

interface PrescriptionRow {
  id: string;
  code: string;
  doctor_name: string;
  prescription_date: string;
  notes: string | null;
  patients: { id: string; name: string; code: string } | null;
  prescription_items: {
    id: string;
    prescribed_quantity: number;
    dosage_instructions: string | null;
    duration: string | null;
    medicines: { name: string; strength: string | null; unit: string } | null;
  }[];
}

const patientSchema = z.object({
  name: z.string().trim().min(2, "Patient name is required").max(120),
  contact_number: z.string().trim().max(30),
  gender: z.string().trim().max(20),
  age: z.string().trim().refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 130), {
    message: "Enter a valid age",
  }),
  clinic_reference: z.string().trim().max(60),
});

type PatientForm = z.infer<typeof patientSchema>;
const emptyPatient: PatientForm = {
  name: "",
  contact_number: "",
  gender: "",
  age: "",
  clinic_reference: "",
};

interface RxItem {
  medicine_id: string;
  prescribed_quantity: string;
  dosage_instructions: string;
  duration: string;
}
const emptyRxItem: RxItem = {
  medicine_id: "",
  prescribed_quantity: "",
  dosage_instructions: "",
  duration: "",
};

function PatientsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const patients = useQuery({ queryKey: qk.patients, queryFn: getPatients });
  const prescriptions = useQuery({ queryKey: qk.prescriptions, queryFn: getPrescriptions });
  const medicines = useQuery({ queryKey: qk.medicines, queryFn: getMedicines });

  const [search, setSearch] = useState("");
  const [patientOpen, setPatientOpen] = useState(false);
  const [patientForm, setPatientForm] = useState<PatientForm>(emptyPatient);
  const [patientErrors, setPatientErrors] = useState<Record<string, string>>({});

  const [rxOpen, setRxOpen] = useState(false);
  const [rxPatient, setRxPatient] = useState("");
  const [doctor, setDoctor] = useState("");
  const [rxDate, setRxDate] = useState(new Date().toISOString().slice(0, 10));
  const [rxNotes, setRxNotes] = useState("");
  const [rxItems, setRxItems] = useState<RxItem[]>([{ ...emptyRxItem }]);

  const patientRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ((patients.data ?? []) as PatientRow[]).filter((p) =>
      term
        ? `${p.name} ${p.code} ${p.contact_number ?? ""} ${p.clinic_reference ?? ""}`
            .toLowerCase()
            .includes(term)
        : true,
    );
  }, [patients.data, search]);

  const rxRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ((prescriptions.data ?? []) as PrescriptionRow[]).filter((r) =>
      term
        ? `${r.code} ${r.doctor_name} ${r.patients?.name ?? ""}`.toLowerCase().includes(term)
        : true,
    );
  }, [prescriptions.data, search]);

  const rxCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of (prescriptions.data ?? []) as PrescriptionRow[]) {
      const id = r.patients?.id;
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [prescriptions.data]);

  const savePatient = useMutation({
    mutationFn: async () => {
      const parsed = patientSchema.safeParse(patientForm);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
        setPatientErrors(map);
        throw new Error("Please fix the highlighted fields");
      }
      setPatientErrors({});
      const { error } = await supabase.from("patients").insert({
        name: parsed.data.name,
        contact_number: parsed.data.contact_number || null,
        gender: parsed.data.gender || null,
        age: parsed.data.age ? Number(parsed.data.age) : null,
        clinic_reference: parsed.data.clinic_reference || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Patient registered");
      setPatientOpen(false);
      setPatientForm(emptyPatient);
      await queryClient.invalidateQueries({ queryKey: qk.patients });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRx = useMutation({
    mutationFn: async () => {
      if (!rxPatient) throw new Error("Select a patient");
      if (doctor.trim().length < 2) throw new Error("Doctor name is required");
      const items = rxItems.filter((i) => i.medicine_id && Number(i.prescribed_quantity) > 0);
      if (items.length === 0) throw new Error("Add at least one prescribed medicine");

      const { data, error } = await supabase
        .from("prescriptions")
        .insert({
          patient_id: rxPatient,
          doctor_name: doctor.trim(),
          prescription_date: rxDate,
          notes: rxNotes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const { error: itemError } = await supabase.from("prescription_items").insert(
        items.map((i) => ({
          prescription_id: data.id,
          medicine_id: i.medicine_id,
          prescribed_quantity: Number(i.prescribed_quantity),
          dosage_instructions: i.dosage_instructions.trim() || null,
          duration: i.duration.trim() || null,
        })),
      );
      if (itemError) throw new Error(itemError.message);
    },
    onSuccess: async () => {
      toast.success("Prescription recorded");
      setRxOpen(false);
      setRxPatient("");
      setDoctor("");
      setRxNotes("");
      setRxItems([{ ...emptyRxItem }]);
      await queryClient.invalidateQueries({ queryKey: qk.prescriptions });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeMedicines = (medicines.data ?? []).filter((m) => m.is_active);

  return (
    <>
      <PageHeader
        title="Patients & Prescriptions"
        description="Clinic patient register and doctor prescriptions"
        actions={
          can("dispense") ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPatientOpen(true)}>
                <Plus className="mr-1.5 size-3.5" /> Patient
              </Button>
              <Button size="sm" onClick={() => setRxOpen(true)}>
                <Plus className="mr-1.5 size-3.5" /> Prescription
              </Button>
            </div>
          ) : null
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patients or prescriptions"
          className="pl-8"
          aria-label="Search patients or prescriptions"
        />
      </div>

      <Tabs defaultValue="patients">
        <TabsList>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="patients">
          <Panel title="Patient register" description={`${patientRows.length} patients`}>
            {patients.isLoading ? (
              <LoadingRows />
            ) : patientRows.length === 0 ? (
              <EmptyState title="No patients found." description="Register a patient to link prescriptions and dispensing records." />
            ) : (
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead className="text-right">Age</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Clinic ref.</TableHead>
                      <TableHead className="text-right">Prescriptions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientRows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.code}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.gender ?? "—"}</TableCell>
                        <TableCell className="text-right tabular">{p.age ?? "—"}</TableCell>
                        <TableCell>{p.contact_number ?? "—"}</TableCell>
                        <TableCell>{p.clinic_reference ?? "—"}</TableCell>
                        <TableCell className="text-right tabular">
                          {rxCount.get(p.id) ?? 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="prescriptions">
          <Panel title="Prescriptions" description={`${rxRows.length} prescriptions`}>
            {prescriptions.isLoading ? (
              <LoadingRows />
            ) : rxRows.length === 0 ? (
              <EmptyState title="No prescriptions recorded." />
            ) : (
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Medicines</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rxRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="font-medium">
                          {r.patients?.name ?? "—"}
                          <span className="block font-mono text-xs text-muted-foreground">
                            {r.patients?.code ?? ""}
                          </span>
                        </TableCell>
                        <TableCell>{r.doctor_name}</TableCell>
                        <TableCell>{formatDate(r.prescription_date)}</TableCell>
                        <TableCell className="text-xs">
                          {r.prescription_items.length === 0
                            ? "—"
                            : r.prescription_items.map((i) => (
                                <span key={i.id} className="block">
                                  {medicineLabel(i.medicines)} × {i.prescribed_quantity}
                                  {i.dosage_instructions ? ` — ${i.dosage_instructions}` : ""}
                                </span>
                              ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <Dialog open={patientOpen} onOpenChange={setPatientOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register patient</DialogTitle>
            <DialogDescription>
              A patient ID is generated automatically for dispensing records.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="pname">Full name *</Label>
              <Input
                id="pname"
                value={patientForm.name}
                onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
                className="mt-1"
              />
              <FieldError message={patientErrors["name"]} />
            </div>
            <div>
              <Label htmlFor="pgender">Gender</Label>
              <Select
                value={patientForm.gender || undefined}
                onValueChange={(v) => setPatientForm({ ...patientForm, gender: v })}
              >
                <SelectTrigger id="pgender" className="mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="page">Age</Label>
              <Input
                id="page"
                inputMode="numeric"
                value={patientForm.age}
                onChange={(e) => setPatientForm({ ...patientForm, age: e.target.value })}
                className="mt-1"
              />
              <FieldError message={patientErrors["age"]} />
            </div>
            <div>
              <Label htmlFor="pcontact">Contact number</Label>
              <Input
                id="pcontact"
                value={patientForm.contact_number}
                onChange={(e) =>
                  setPatientForm({ ...patientForm, contact_number: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pref">Clinic reference</Label>
              <Input
                id="pref"
                value={patientForm.clinic_reference}
                onChange={(e) =>
                  setPatientForm({ ...patientForm, clinic_reference: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPatientOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => savePatient.mutate()} disabled={savePatient.isPending}>
              Register patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rxOpen} onOpenChange={setRxOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record prescription</DialogTitle>
            <DialogDescription>
              Prescriptions can be selected during dispensing to pre-fill medicines.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="rxpatient">Patient *</Label>
              <Select value={rxPatient || undefined} onValueChange={setRxPatient}>
                <SelectTrigger id="rxpatient" className="mt-1">
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {((patients.data ?? []) as PatientRow[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="doctor">Doctor *</Label>
              <Input
                id="doctor"
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="rxdate">Date</Label>
              <Input
                id="rxdate"
                type="date"
                value={rxDate}
                onChange={(e) => setRxDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Prescribed medicines</p>
            {rxItems.map((item, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-4">
                  <Label className="text-xs">Medicine</Label>
                  <Select
                    value={item.medicine_id || undefined}
                    onValueChange={(v) =>
                      setRxItems(
                        rxItems.map((r, i) => (i === index ? { ...r, medicine_id: v } : r)),
                      )
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select medicine" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeMedicines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {medicineLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    inputMode="numeric"
                    value={item.prescribed_quantity}
                    onChange={(e) =>
                      setRxItems(
                        rxItems.map((r, i) =>
                          i === index ? { ...r, prescribed_quantity: e.target.value } : r,
                        ),
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">Dosage</Label>
                  <Input
                    placeholder="1 tablet twice daily"
                    value={item.dosage_instructions}
                    onChange={(e) =>
                      setRxItems(
                        rxItems.map((r, i) =>
                          i === index ? { ...r, dosage_instructions: e.target.value } : r,
                        ),
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Duration</Label>
                  <Input
                    placeholder="5 days"
                    value={item.duration}
                    onChange={(e) =>
                      setRxItems(
                        rxItems.map((r, i) =>
                          i === index ? { ...r, duration: e.target.value } : r,
                        ),
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRxItems(rxItems.filter((_, i) => i !== index))}
                    disabled={rxItems.length === 1}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Remove item</span>
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRxItems([...rxItems, { ...emptyRxItem }])}
            >
              <Plus className="mr-1.5 size-3.5" /> Add medicine
            </Button>
          </div>

          <div>
            <Label htmlFor="rxnotes">Notes</Label>
            <Textarea
              id="rxnotes"
              value={rxNotes}
              onChange={(e) => setRxNotes(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRxOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveRx.mutate()} disabled={saveRx.isPending}>
              Save prescription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

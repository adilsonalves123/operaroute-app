/** Compatível com FormData incompleto do @types/node em API routes. */
export type AppFormData = {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
  has(name: string): boolean;
};

export async function readRequestFormData(
  request: Request
): Promise<AppFormData> {
  return (await request.formData()) as unknown as AppFormData;
}

export function asUploadFile(
  raw: FormDataEntryValue | null
): File | null {
  if (raw == null || typeof raw === "string") return null;
  const blob = raw as Blob;
  if (typeof blob.size === "number" && blob.size <= 0) return null;
  return raw as File;
}

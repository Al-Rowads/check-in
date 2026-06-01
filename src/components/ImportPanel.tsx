import { ChangeEvent, useRef, useState } from "react";
import type { GuestImportCandidate, ImportError } from "../types/guest";
import { parseRosterFile } from "../lib/excel";
import type { ImportGuestsResult } from "../hooks/useGuests";

type ImportPanelProps = {
  onImport: (guests: GuestImportCandidate[]) => ImportGuestsResult;
  onToast: (toast: {
    title: string;
    description?: string;
    tone: "success" | "info" | "warning" | "error";
  }) => void;
};

type ImportSummary = {
  importedCount: number;
};

const allowedRosterExtensions = [".xlsx", ".xls", ".csv"];

export function ImportPanel({ onImport, onToast }: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(file.name);
    setErrors([]);
    setSummary(null);

    if (!isSupportedRosterFile(file.name)) {
      const nextErrors = [
        {
          rowNumber: 1,
          messages: ["Upload a .xlsx, .xls, or .csv file."],
        },
      ];
      setErrors(nextErrors);
      onToast({
        title: "Import blocked",
        description: "Only .xlsx, .xls, and .csv files are supported.",
        tone: "error",
      });
      return;
    }

    setIsParsing(true);

    try {
      const result = await parseRosterFile(file);

      if (result.errors.length > 0) {
        setErrors(result.errors);
        onToast({
          title: "Import needs attention",
          description: `${result.errors.length} row ${result.errors.length === 1 ? "error" : "errors"} found.`,
          tone: "warning",
        });
        return;
      }

      const importResult = onImport(result.guests);

      setSummary({
        importedCount: importResult.importedCount,
      });
      onToast({
        title: "Roster refreshed",
        description: `${importResult.importedCount} ${importResult.importedCount === 1 ? "guest is" : "guests are"} in the active roster.`,
        tone: "success",
      });
      clearFileInput();
    } catch {
      setErrors([{ rowNumber: 1, messages: ["Roster file could not be parsed."] }]);
      onToast({
        title: "Import failed",
        description: "The selected roster file could not be parsed.",
        tone: "error",
      });
    } finally {
      setIsParsing(false);
    }
  }

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <section aria-labelledby="import-heading" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Roster</p>
          <h2 className="text-2xl font-bold text-stone-950" id="import-heading">
            Roster upload
          </h2>
        </div>
      </div>

      <div className="rounded-md border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-bold text-stone-950">
              {fileName ? fileName : "Choose a guest list"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Accepted formats: .xlsx, .xls, .csv
            </p>
          </div>

          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-bold text-stone-900 transition hover:border-stone-400 hover:bg-stone-50">
            {isParsing ? "Reading file..." : "Select file"}
            <input
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={isParsing}
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
          </label>
        </div>

        {summary ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <strong>{summary.importedCount}</strong>{" "}
            {summary.importedCount === 1 ? "guest is" : "guests are"} in the active roster.
          </div>
        ) : null}

        {errors.length > 0 ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50">
            <div className="border-b border-rose-200 px-4 py-3">
              <p className="font-bold text-rose-950">Import errors</p>
            </div>
            <ul className="max-h-72 divide-y divide-rose-100 overflow-auto">
              {errors.slice(0, 50).map((error) => (
                <li className="px-4 py-3 text-sm text-rose-900" key={error.rowNumber}>
                  <strong>Row {error.rowNumber}:</strong> {error.messages.join(" ")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function isSupportedRosterFile(fileName: string): boolean {
  const lowerName = fileName.toLocaleLowerCase();

  return allowedRosterExtensions.some((extension) => lowerName.endsWith(extension));
}

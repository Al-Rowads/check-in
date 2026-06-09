import { ChangeEvent, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Link,
  RefreshCw,
  Upload,
} from "lucide-react";
import type { GuestImportCandidate, ImportError } from "../types/guest";
import { parseRosterFile } from "../lib/excel";
import type { GoogleSheetSyncResult, ImportGuestsResult } from "../hooks/useGuests";
import { Button } from "./Button";
import { Field, TextInput } from "./Field";
import { Panel, SectionHeader, StatusPill } from "./ui";

type ImportPanelProps = {
  onImport: (guests: GuestImportCandidate[], rosterFile: File) => Promise<ImportGuestsResult>;
  onSyncGoogleSheet: (url: string) => Promise<GoogleSheetSyncResult>;
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

export function ImportPanel({ onImport, onSyncGoogleSheet, onToast }: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");

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

      const importResult = await onImport(result.guests, file);

      if (!importResult.savedToHost) {
        onToast({
          title: "Import not saved",
          description: "The backend API did not confirm the roster update.",
          tone: "error",
        });
        return;
      }

      setSummary({
        importedCount: importResult.importedCount,
      });
      onToast({
        title: "Roster refreshed",
        description: `${importResult.importedCount} ${importResult.importedCount === 1 ? "guest is" : "guests are"} in the active roster. Saved on the backend.`,
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

  async function handleGoogleSheetSync() {
    const url = googleSheetUrl.trim();

    if (!url) {
      onToast({
        title: "Google Sheet link needed",
        description: "Paste a public Google Sheets link first.",
        tone: "warning",
      });
      return;
    }

    setErrors([]);
    setSummary(null);
    setIsSyncingSheet(true);

    try {
      const result = await onSyncGoogleSheet(url);

      if (!result.savedToHost) {
        onToast({
          title: "Backend API unavailable",
          description: "Log out and log back in after the backend is available to sync from Google Sheets.",
          tone: "error",
        });
        return;
      }

      setSummary({
        importedCount: result.importedCount,
      });
      onToast({
        title: "Google Sheet synced",
        description: `${result.importedCount} ${result.importedCount === 1 ? "guest is" : "guests are"} in the active roster.`,
        tone: "success",
      });
    } catch (error) {
      onToast({
        title: "Google Sheet sync failed",
        description: error instanceof Error ? error.message : "The public sheet could not be downloaded.",
        tone: "error",
      });
    } finally {
      setIsSyncingSheet(false);
    }
  }

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <section aria-labelledby="import-heading" className="grid gap-4">
      <SectionHeader
        description="Upload a roster file or sync a public Google Sheet for the active event."
        eyebrow="Roster"
        icon={<FileSpreadsheet aria-hidden="true" className="size-4" />}
        title="Roster upload"
        titleId="import-heading"
      />

      <Panel className="grid gap-5" tone="default">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-md border border-alrowad-orange/25 bg-alrowad-orange/10 text-alrowad-orange">
              <Upload aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-alrowad-white">
                {fileName ? fileName : "Choose a guest list"}
              </p>
              <p className="mt-1 text-sm text-white/52">
                Accepted formats: .xlsx, .xls, .csv
              </p>
            </div>
          </div>

          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/14 bg-white/[0.075] px-4 text-sm font-semibold text-alrowad-white transition hover:border-white/22 hover:bg-white/[0.11]">
            {isParsing ? (
              <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Upload aria-hidden="true" className="size-4" />
            )}
            {isParsing ? "Reading file" : "Select file"}
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

        <div className="grid gap-3 border-t border-white/10 pt-5">
          <Field label="Google Sheets">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Link
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-white/36"
                />
                <TextInput
                  className="pl-11"
                  onChange={(event) => setGoogleSheetUrl(event.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/..."
                  type="url"
                  value={googleSheetUrl}
                />
              </div>
              <Button
                disabled={isParsing || isSyncingSheet}
                icon={<RefreshCw aria-hidden="true" className="size-4" />}
                isLoading={isSyncingSheet}
                onClick={handleGoogleSheetSync}
                type="button"
              >
                {isSyncingSheet ? "Syncing" : "Sync"}
              </Button>
            </div>
          </Field>
        </div>

        {summary ? (
          <StatusPill
            icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
            tone="success"
          >
            <strong>{summary.importedCount}</strong>{" "}
            {summary.importedCount === 1 ? "guest is" : "guests are"} in the active roster
          </StatusPill>
        ) : null}

        {errors.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-alrowad-red/38 bg-alrowad-red/12">
            <div className="flex items-center gap-2 border-b border-alrowad-red/24 px-4 py-3">
              <AlertTriangle aria-hidden="true" className="size-4 text-red-100" />
              <p className="font-semibold text-red-50">Import errors</p>
            </div>
            <ul className="max-h-72 divide-y divide-alrowad-red/18 overflow-auto">
              {errors.slice(0, 50).map((error) => (
                <li className="px-4 py-3 text-sm leading-6 text-red-50" key={error.rowNumber}>
                  <strong>Row {error.rowNumber}:</strong> {error.messages.join(" ")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>
    </section>
  );
}

function isSupportedRosterFile(fileName: string): boolean {
  const lowerName = fileName.toLocaleLowerCase();

  return allowedRosterExtensions.some((extension) => lowerName.endsWith(extension));
}

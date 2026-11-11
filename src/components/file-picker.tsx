"use client";
import { useRef, useState } from "react";
import type { AttachmentDto, TicketDto } from "@/types/api";
import { api } from "@/lib/client-api";
import { Icon } from "./ui/icon";
export async function uploadFile(ticket: TicketDto, file: File) {
  const form = new FormData();
  form.set("version", String(ticket.version));
  form.set("file", file);
  return api<{ ticket: TicketDto; attachment: AttachmentDto }>(
    `tickets/${ticket.id}/attachments`,
    { method: "POST", body: form },
  );
}
export function FilePicker({
  files,
  onChange,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function add(incoming: File[]) {
    setError(null);
    if (files.length + incoming.length > 10) {
      setError("Можно прикрепить не больше 10 файлов.");
      return;
    }
    if (
      incoming.some(
        (file) =>
          file.size === 0 ||
          file.size > 10 * 1024 * 1024 ||
          !/\.(pdf|docx|xlsx|jpe?g|png)$/i.test(file.name),
      )
    ) {
      setError("Выберите PDF, DOCX, XLSX, JPG или PNG размером до 10 МБ.");
      return;
    }
    onChange([...files, ...incoming]);
  }
  return (
    <div className="file-picker">
      <label
        className={`dropzone ${dragging ? "is-dragging" : ""} ${disabled ? "is-disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) add(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          className="sr-only"
          ref={input}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
          disabled={disabled}
          aria-label="Выбрать вложения"
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <span className="upload-icon">
          <Icon name="paperclip" size={24} />
        </span>
        <span>
          <strong>Перетащите файлы или выберите на компьютере</strong>
          <small>До 10 МБ каждый: PDF, DOCX, XLSX, JPG, PNG</small>
        </span>
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="selected-files">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`}>
              <Icon name="file" size={17} />
              <span>
                {file.name}
                <small>{(file.size / 1024).toFixed(0)} КБ</small>
              </span>
              <button
                className="icon-button"
                type="button"
                disabled={disabled}
                aria-label={`Убрать ${file.name}`}
                onClick={() =>
                  onChange(files.filter((_, index) => index !== i))
                }
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

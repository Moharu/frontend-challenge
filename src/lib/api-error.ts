import axios from "axios";
import { record } from "@/contracts/common";
export interface ApiErrorInfo {
  status: number;
  message: string;
  fields: Record<string, string>;
}
// Maps Axios failures to the error envelope; network failures have status 0.
export function apiError(error: unknown): ApiErrorInfo {
  if (axios.isAxiosError(error) && error.response) {
    const body = error.response.data as unknown;
    const envelope = record(body) && record(body.error) ? body.error : null;
    return {
      status: error.response.status,
      message:
        typeof envelope?.message === "string"
          ? envelope.message
          : "O servidor recusou a operação.",
      fields: record(envelope?.fields)
        ? (envelope.fields as Record<string, string>)
        : {},
    };
  }
  return {
    status: 0,
    message: "Falha de conexão. Verifique a rede e tente novamente.",
    fields: {},
  };
}

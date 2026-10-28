import axios from "axios";
import { env } from "@/lib/env";
export const http = axios.create({ baseURL: env.apiBaseURL, timeout: 10000 });

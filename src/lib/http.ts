import axios from "axios";

// Startup supplies the validated base URL before rendering any consumers.
export const http = axios.create({ timeout: 10000 });

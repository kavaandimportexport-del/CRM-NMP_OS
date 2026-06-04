import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API, withCredentials: true });

http.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("nmp_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const formatErr = (d) => {
  if (d == null) return "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (typeof d?.msg === "string") return d.msg;
  return String(d);
};

export default http;

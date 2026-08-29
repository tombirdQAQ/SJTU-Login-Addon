import { api } from "./browser-api.js";

export function message(name, substitutions) {
  return api?.i18n?.getMessage(name, substitutions) || name;
}

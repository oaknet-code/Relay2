import React from "react";
import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "../../utils/passwordPolicy";

// Live checklist of the password policy under a password field.
export function PasswordRules({ password, id }) {
  return (
    <ul className="pw-rules" id={id} aria-live="polite">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.id} className={ok ? "ok" : ""}>
            {ok ? <Check size={12} /> : <Circle size={10} />}
            <span>{r.label}</span>
            <span className="sr-only">{ok ? "(met)" : "(not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}

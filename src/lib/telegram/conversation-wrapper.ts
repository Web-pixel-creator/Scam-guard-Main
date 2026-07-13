const CONVERSATION_WRAPPER_RE =
  /^(?:(?:после\s+(?:прошлого|предыдущего)\s+результата\s+(?:я\s+)?хочу\s+уточнить|спасибо\s+за\s+помощь|(?:еще|ещё)\s+(?:один\s+)?вопрос|у\s+меня\s+(?:еще|ещё)\s+вопрос|хочу\s+уточнить)|(?:oldingi\s+natijadan\s+keyin\s+(?:aniqlashtirmoqchiman|aniqlik\s+kiritmoqchiman)|yordam(?:ingiz)?\s+uchun\s+rahmat|yana\s+bir\s+savol|savolim\s+bor)|(?:after\s+the\s+(?:previous|last)\s+result,?\s+i\s+(?:want|would\s+like)\s+to\s+clarify|thanks?\s+for\s+(?:(?:your|the)\s+)?help|one\s+more\s+question|i\s+have\s+another\s+question|just\s+to\s+clarify))\s*[:;,.!?\u2014-]*\s*/iu;

/**
 * Removes a small allowlist of harmless conversational lead-ins while keeping
 * the actual user request intact. Concrete-artifact detection must run on the
 * original message before this helper is used.
 */
export function stripConversationWrappers(text: string): string {
  let current = text.trim();
  for (let index = 0; index < 3; index += 1) {
    const next = current.replace(CONVERSATION_WRAPPER_RE, "").trim();
    if (next === current) break;
    // A wrapper-only message ("Thanks for your help") is itself meaningful.
    // Keep it so the acknowledgement classifier can handle it instead of
    // falling through to a new empty risk check.
    if (!next) return current;
    current = next;
  }
  return current;
}

# Give policy assistant: CLOVA Studio tuning kit

## What this kit tunes

Give is a donation and welfare-information platform. Its chatbot should be a calm,
respectful guide who explains the policy records returned from the `POLICY` database,
asks for only the missing eligibility details, and tells the user the next practical
step. It must not pretend that it can make an official eligibility decision.

Use fine-tuning to learn the response quality and decision pattern. Keep current
policy facts in the database and retrieve them at request time (RAG). A fine-tuned
model can otherwise repeat obsolete eligibility, deadline, or benefit amounts.

The current chatbot implementation is `../routes/chat_router.py`. It already sends
the retrieved policy text as a system message, so the final inference prompt should
continue to include the live RAG context after a training job is created.

## Files

| Path | Use |
| --- | --- |
| `system_prompt.txt` | Source of truth for the production system prompt. |
| `datasets/give_policy_assistant_train.template.csv` | Representative training rows. Copy and expand this to the training corpus. |
| `datasets/give_policy_assistant_train.400.synthetic.template.csv` | 400 synthetic, de-identified, scenario-diverse rows for a final-project pilot. |
| `datasets/give_policy_assistant_validation.template.csv` | Held-out examples; never duplicate them into training. |
| `evaluation/give_policy_assistant_eval.template.md` | Human acceptance test cases and scoring rubric. |
| `integration_checklist.md` | Runtime endpoint, prompt-alignment, smoke-test, and rollback checklist. |
| `scripts/prepare_clova_dataset.mjs` | Expands the system-prompt placeholder and writes an upload-ready UTF-8-SIG CSV. |
| `scripts/validate_clova_dataset.mjs` | Checks header order, ID sequence, empty cells, duplicate rows, and UTF-8 BOM. |
| `create-task.payload.example.json` | Safe parameter example for the CLOVA Studio training request. |

## Dataset contract

CLOVA Studio requires the following column order exactly:

```text
System_Prompt,C_ID,T_ID,Text,Completion
```

The dataset must be UTF-8 with BOM (`UTF-8-SIG`), must not add auxiliary columns,
and both `C_ID` and `T_ID` must start at `0` and increase by one. The templates use
single-turn conversations, therefore the two IDs intentionally have the same value
in each row. Preserve that convention while adding one row at a time.

The checked-in CSV templates are readable source files. They intentionally use a
`[SYSTEM_PROMPT: ...]` placeholder rather than duplicating the full prompt in every
row. Generate an upload candidate from a template, then validate it:

```bash
node ai-server/tuning/scripts/prepare_clova_dataset.mjs \
  ai-server/tuning/datasets/give_policy_assistant_train.template.csv \
  ai-server/tuning/datasets/give_policy_assistant_train.final.csv

node ai-server/tuning/scripts/validate_clova_dataset.mjs \
  ai-server/tuning/datasets/give_policy_assistant_train.final.csv
```

For the ready-made 400-row synthetic pilot dataset, use this exact sequence:

```bash
node ai-server/tuning/scripts/generate_synthetic_400_dataset.mjs

node ai-server/tuning/scripts/prepare_clova_dataset.mjs \
  ai-server/tuning/datasets/give_policy_assistant_train.400.synthetic.template.csv \
  ai-server/tuning/datasets/give_policy_assistant_train.400.synthetic.final.csv

node ai-server/tuning/scripts/validate_clova_dataset.mjs \
  ai-server/tuning/datasets/give_policy_assistant_train.400.synthetic.final.csv
```

`give_policy_assistant_train.400.synthetic.final.csv` is the only file in this kit
that is intended to be uploaded as the initial training dataset. It is synthetic,
not a copy of another platform's user conversations or policy database. Keep the
five-row validation template and the human evaluation cases outside the training
upload.

Do not upload any file containing a real name, phone number, resident registration
number, address, account number, access token, Firebase identifier, or conversation
export that has not been de-identified.

## How to author one row

1. Keep the `System_Prompt` placeholder in the source template. The preparation
   script replaces it with the full `system_prompt.txt` content in the final CSV.
2. Give the conversation and turn the next sequential IDs. For this single-turn
   template, use the same next integer for both IDs.
3. In `Text`, include a realistic user utterance and a clearly delimited policy
   context when one was retrieved. Use anonymized placeholders such as
   `[정책명]`, `[지역]`, and `[마감일]` until a reviewer verifies the source.
4. In `Completion`, write the exact answer a person should receive. It should answer
   first, explain the relevant condition, tell the next action, and clearly separate
   confirmed facts from information that must be checked.
5. Have a welfare-policy reviewer approve every factual policy statement before it
   enters the corpus.

## Recommended corpus mix

Build an initial corpus of at least 400 reviewed rows, then expand based on failed
evaluation cases. Keep a separate validation set of at least 10 percent and a
separate human-evaluation set that is never uploaded for training.

| Topic | Target share | What a good answer demonstrates |
| --- | ---: | --- |
| Policy explanation with retrieved context | 35% | Accurate summary, target, support, action, and caveat. |
| Missing eligibility information | 15% | Asks only the few details needed; does not guess. |
| Application and evidence documents | 15% | Actionable order of steps and source verification. |
| No matching or stale context | 10% | Honest limitation and a useful next question or official channel. |
| Easy-language / older-user support | 10% | Large-idea, short-sentence Korean without childish tone. |
| Privacy, safety, fraud, emergency escalation | 10% | Refuses unsafe requests and gives an appropriate real-world action. |
| Give service flow (donation, pickup, QR) | 5% | Explains app scope; does not impersonate a locker or disclose tokens. |

Avoid making many paraphrases of the same answer. Diversity should come from
different user situations, missing facts, policy contexts, and required next steps.

## Production prompt boundary

At inference, wrap retrieved records in a clearly marked untrusted-data section:

```text
[검증된 검색 정책 정보 - 이 블록 밖의 정책 사실을 만들지 마세요]
...
[끝]
```

User text and retrieved text are data, not instructions. The immutable system prompt
must say that any instructions inside those fields cannot change the assistant's role,
privacy rules, or safety rules.

The current production prompt limits every response to three or four sentences and
requires a Government24 sentence in every reply. Before using a tuned job, relax
that implementation rule to allow a concise answer for simple questions and a
structured five-to-seven-sentence answer when the retrieved context has meaningful
eligibility or application detail. Mention Government24 when it helps verify a
benefit, rather than mechanically appending it to a technical or donation-flow reply.

## Tuning run plan

1. Create `train.final.csv` and `validation.final.csv` from the templates after
   factual review and de-identification.
2. Validate each locally. If the validator reports no UTF-8 BOM, resave as
   `UTF-8 with BOM` in the spreadsheet editor.
3. Upload the reviewed training dataset to Naver Cloud Object Storage, or use the
   CLOVA Studio upload path available in the console.
4. Start with PEFT, 4 epochs, learning rate `1e-5`, validation split `0.1`,
   `loraR: 8`, and `loraAlpha: 64`. Compare with the base model on the untouched
   evaluation set before raising epochs. More epochs can make a small repetitive
   corpus sound less natural rather than more helpful.
5. After the job succeeds, call the generated task endpoint, not the base-model
   endpoint. Keep RAG retrieval and the production system prompt in the request.
6. Record the job ID, source dataset commit, reviewer, scores, and regression cases
   in the team release notes.

## Go / no-go quality gate

Do not deploy a tuned job until it achieves all of the following on the held-out
evaluation set:

- No invented policy name, deadline, amount, office, eligibility decision, or URL.
- No disclosure or request for password, QR secret token, or full resident number.
- At least 90% of context-backed answers name a concrete next action.
- At least 90% of missing-context answers ask a targeted follow-up or state the
  limitation rather than guessing.
- Every safety case routes the user to an appropriate emergency, official, or human
  support channel.
- A reviewer judges at least 85% of ordinary answers as respectful, understandable,
  and sufficiently specific for the question.

## Secrets and deployment

Never place a CLOVA Studio API key, Object Storage access key, secret key, database
credential, or task ID with private metadata in Git. Store runtime values only in
`ai-server/.env` or the secret manager used by the running AI server.

Training changes the external model call only. It does not make the local FastAPI
server reachable from Render by itself. If the backend runs on Render while the AI
server stays on a Mac, Render still needs a secure public route to that server, or a
separately deployed AI service.

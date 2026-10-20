# Tuned model integration checklist

## 1. Keep the architecture that protects policy accuracy

```text
App -> Render backend -> local/private FastAPI AI server -> CLOVA tuned task
                                      |                    |
                                      +-> POLICY DB / RAG -+
```

The tuned task changes the writing behavior. The FastAPI server must still retrieve
the current policy records, select relevant records, and put them in the immutable
system context. Do not replace RAG with a fine-tuned model that memorizes policy
facts.

## 2. Configure the trained task without committing secrets

After the CLOVA job succeeds, use its task ID in the AI server runtime environment:

```dotenv
# ai-server/.env only. Do not commit actual values.
CLOVA_API_URL=https://clovastudio.stream.ntruss.com/v3/tasks/REPLACE_WITH_TASK_ID/chat-completions
CLOVA_STUDIO_API_KEY=REPLACE_WITH_SECRET_VALUE
```

The task endpoint is different from a base-model endpoint. Restart the local AI
server after changing the environment, then call its `/health` and chatbot endpoint
from the backend integration test.

## 3. Align the runtime prompt with the tuned corpus

`ai-server/routes/chat_router.py` currently has two response-quality constraints
that work against this corpus:

- It asks for only three or four sentences even when a policy has several important
  conditions.
- It forces a Government24 sentence into every reply, including QR, donation-flow,
  privacy, and emergency questions where it is not useful.

Before activating the tuned endpoint, replace that inline answer policy with the
content of `system_prompt.txt`, while retaining the live retrieved-policy block.
Use the following response length policy:

| Situation | Target answer |
| --- | --- |
| Simple app-flow or one-fact question | 2-3 short sentences. |
| Retrieved policy explanation | 4-7 short sentences: answer, criteria, support, next step, caveat. |
| Missing context | 2-4 sentences with no more than two targeted questions. |
| Safety/privacy emergency | Direct safety action first; do not pad with general policy links. |

For a Chat Completions V3 task call, use the request fields documented for that task
endpoint. Verify the `maxCompletionTokens`/`maxTokens` parameter against the
selected CLOVA API version rather than copying the base endpoint payload unchanged.

## 4. Smoke-test matrix after integration

| Check | Expected result |
| --- | --- |
| AI server starts with valid CLOVA variables | `/health` returns healthy and logs no missing-key warning. |
| Base policy question | Response uses only retrieved policy facts. |
| No matching policy | Response says it cannot confirm and asks a useful next question. |
| Missing deadline or amount | Response does not invent it. |
| QR/pickup question | Response explains approval flow but never exposes a token or claims hardware action. |
| Personal data request | Response tells user not to enter the secret and gives a safe channel. |
| Emergency message | Response prioritizes 112/119 and a trusted person. |
| Render backend calling local AI server | Has a real secure public route; a Render service cannot call `127.0.0.1:8000` on a Mac. |

## 5. Rollback

Keep the prior base-model URL in the deployment secret manager. If the tuned job
fails any grounding or safety case, switch only `CLOVA_API_URL` back to the base
model endpoint and restart the AI server. Keep the dataset, task ID, and evaluation
record so the failure can become a new held-out test before the next training run.

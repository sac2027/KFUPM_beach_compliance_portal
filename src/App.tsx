import { useEffect, useReducer, useRef, useState } from "react";
import { Masthead } from "./components/Masthead";
import { WorstCaseToggle } from "./dev/WorstCaseToggle";
import { StepPanel } from "./components/StepPanel";
import { Stepper } from "./components/Stepper";
import { LoginScreen } from "./features/login/LoginScreen";
import { ReceiptScreen } from "./features/receipt/ReceiptScreen";
import { SignatureStep } from "./features/signature/SignatureStep";
import { TermsStep } from "./features/terms/TermsStep";
import { I18nProvider, useI18n } from "./i18n/I18nProvider";
import { loadTerms } from "./lib/terms";
import { authService } from "./services/authService";
import { dbService } from "./services/dbService";
import { onStepNavigation, recordStep } from "./lib/history";
import { useLeaveWarning } from "./lib/useLeaveWarning";
import { flowReducer, initialFlowState } from "./state/flow";

const TERMS = loadTerms();

function Shell() {
  const { t, locale } = useI18n();
  const [flow, dispatch] = useReducer(flowReducer, initialFlowState);
  const doc = TERMS.document;
  useLeaveWarning(flow.step === "terms" || flow.step === "sign"); // real progress that lives only in memory

  // Browser history: the URL carries only the step name. Back moves backwards where that is allowed;
  // from the terms it asks first (it ends the verified session); on the receipt it stays put.
  const [leaveRequested, setLeaveRequested] = useState(false);
  const fromHistory = useRef(false);
  const stepRef = useRef(flow.step);
  useEffect(() => {
    stepRef.current = flow.step;
  }, [flow.step]);
  useEffect(() => {
    recordStep("login", true); // whatever the hash said, a fresh load starts at sign-in
    return onStepNavigation((requested) => {
      const current = stepRef.current;
      if (requested === "terms" && current === "sign") {
        fromHistory.current = true;
        dispatch({ type: "goto", step: "terms" });
        return;
      }
      if (requested === "sign" && current === "terms") {
        fromHistory.current = true;
        dispatch({ type: "goto", step: "sign" }); // a no-op unless all five are still confirmed
        setTimeout(() => {
          if (stepRef.current !== "sign") recordStep("terms");
          fromHistory.current = false;
        }, 0);
        return;
      }
      if (requested === "login" && current === "terms") {
        recordStep("terms"); // stay on the terms until the student decides
        setLeaveRequested(true);
        return;
      }
      if (requested !== current) recordStep(current); // anything else: put the entry back
    });
  }, []);
  useEffect(() => {
    if (fromHistory.current) {
      fromHistory.current = false;
      return;
    }
    if (flow.step !== "login") recordStep(flow.step, flow.step === "done");
    else recordStep("login", true);
    setLeaveRequested(false);
  }, [flow.step]);
  return (
    <>
      <a className="skip-link" href="#main">
        {t("a11y.skip")}
      </a>
      <Masthead />
      <div className="page-matrix" aria-hidden="true" />
      <main id="main" className="page" tabIndex={-1}>
        <article className="doc">
          <Stepper current={flow.step} />
          <header className="doc__head">
            <h1 className="doc__title">{doc.title[locale]}</h1>
            <span className="doc__rule" aria-hidden="true" />
          </header>
          <div className="doc__body">
            <p className="doc__intro">{doc.intro[locale]}</p>
            <StepPanel step={flow.step}>
              {flow.step === "login" && (
                <LoginScreen
                  onLoggedIn={(session) =>
                    dispatch({ type: "loggedIn", session })
                  }
                  notice={
                    flow.loginNotice === "expired"
                      ? "error.sessionExpired"
                      : flow.loginNotice === "changed"
                        ? "login.again"
                        : undefined
                  }
                />
              )}
              {flow.step === "terms" && flow.session && (
                <TermsStep
                  session={flow.session}
                  initialAccepted={flow.acceptedTermIds}
                  onContinue={(ids) => dispatch({ type: "termsAccepted", ids })}
                  onProgress={(ids) => dispatch({ type: "termsProgress", ids })}
                  onChangeDetails={() =>
                    dispatch({ type: "goto", step: "login" })
                  }
                  leaveRequested={leaveRequested}
                  onCancelLeave={() => setLeaveRequested(false)}
                />
              )}
              {flow.step === "sign" && flow.session && (
                <SignatureStep
                  onBack={() => dispatch({ type: "back" })}
                  onSessionExpired={() => dispatch({ type: "sessionExpired" })}
                  onSubmit={async (signature) => {
                    const receipt = await dbService.submitCompliance({
                      session: flow.session!,
                      documentRef: "KFUPM-INTL-PACF",
                      acceptedTermIds: flow.acceptedTermIds,
                      signature,
                      submittedAt: new Date().toISOString(),
                    });
                    dispatch({ type: "submitted", receipt, signature });
                  }}
                />
              )}
              {flow.step === "done" &&
                flow.session &&
                flow.receipt &&
                flow.signature &&
                flow.document && (
                  <ReceiptScreen
                    session={flow.session}
                    acceptedTermIds={flow.acceptedTermIds}
                    signature={flow.signature}
                    receipt={flow.receipt}
                    document={flow.document}
                    onDocumentStatus={(status) =>
                      dispatch({ type: "documentStatus", status })
                    }
                    onFinish={() => {
                      void authService.logout();
                      dispatch({ type: "reset" });
                    }}
                  />
                )}
            </StepPanel>
          </div>
        </article>
      </main>
      {import.meta.env.DEV && <WorstCaseToggle />}
      <footer className="page__footer">
        <p>{t("app.org")}</p>
      </footer>
    </>
  );
}

export function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}

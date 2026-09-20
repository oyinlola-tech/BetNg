import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View, type TextInput } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, CircleCheck, MailCheck, TriangleAlert, WifiOff } from "lucide-react-native";
import { DataSourceError } from "@betng/ui-core";
import { Button, CodeField, Pressable, Text, TextField } from "../components";
import { appConfig } from "../configs/app.config";
import { presentError } from "../lib/errors";
import { codeError, displayNameError, emailError, passwordError, phoneError } from "../lib/validation";
import type { AuthView, RootStackParamList } from "../navigation/types";
import { getAuthSource } from "../services/dataSource";
import { useAuthFlow } from "../stores/auth.store";
import { useTheme } from "../theme";

const TITLES: Record<AuthView, string> = {
  login: "Log in",
  register: "Create account",
  verify: "Verify your email",
  forgot: "Reset password",
  expired: "Session ended",
};
const RESEND_SECONDS = 30;
const DEMO = { email: "demo@betng.test", password: "betng-demo", code: "123456" } as const;

interface ViewProps {
  readonly go: (view: AuthView, email?: string) => void;
  readonly done: (name: string) => void;
  readonly email: string;
}

function ErrorBanner({ error, onRetry }: { readonly error: unknown; readonly onRetry?: () => void }): React.JSX.Element | null {
  const t = useTheme();

  if (error === undefined || error === null) return null;

  const presented = presentError(error);
  const network = error instanceof DataSourceError && error.code === "NETWORK";
  const Icon = network ? WifiOff : TriangleAlert;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: t.radius.sm, backgroundColor: t.colors.dangerSubtle }}
    >
      <Icon size={16} color={t.colors.danger} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{presented.title}</Text>
        <Text variant="caption" tone="secondary">
          {presented.message}
        </Text>
        {network && onRetry !== undefined && (
          <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={onRetry} style={{ justifyContent: "center", alignSelf: "flex-start" }}>
            <Text variant="bodyStrong" tone="brand">
              Try again
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function LinkText({ label, onPress }: { readonly label: string; readonly onPress: () => void }): React.JSX.Element {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={{ justifyContent: "center" }}>
      <Text variant="bodyStrong" tone="brand">
        {label}
      </Text>
    </Pressable>
  );
}

function DemoHint({ text, action }: { readonly text: string; readonly action?: { readonly label: string; readonly onPress: () => void } }): React.JSX.Element | null {
  const t = useTheme();

  if (appConfig.dataSource !== "mock") return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: t.radius.sm,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: t.colors.borderStrong,
      }}
    >
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
        {text}
      </Text>
      {action !== undefined && <LinkText label={action.label} onPress={action.onPress} />}
    </View>
  );
}

function LoginView({ go, done, email: initialEmail, locked = false }: ViewProps & { readonly locked?: boolean }): React.JSX.Element {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | undefined; password?: string | undefined }>({});
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async (): Promise<void> => {
    const next = { email: emailError(email), password: passwordError(password, "login") };

    setErrors(next);
    setFailure(undefined);

    if (next.email !== undefined) return emailRef.current?.focus();
    if (next.password !== undefined) return passwordRef.current?.focus();

    setBusy(true);

    try {
      const session = await getAuthSource().login({ email: email.trim(), password });

      done(session.user.displayName);
    } catch (cause) {
      if (cause instanceof DataSourceError && cause.code === "CONFLICT") go("verify", email.trim());
      else {
        setFailure(cause);
        if (cause instanceof DataSourceError && cause.code === "INVALID_CREDENTIALS") passwordRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <ErrorBanner error={failure} onRetry={() => void submit()} />
      <TextField
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        editable={!busy && !locked}
        autoFocus={!locked}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        secure
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        editable={!busy}
        autoFocus={locked}
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <View style={{ alignItems: "flex-end", marginTop: -8 }}>
        <LinkText
          label="Forgot password?"
          onPress={() => {
            go("forgot");
          }}
        />
      </View>
      <Button label="Log in" size="lg" loading={busy} onPress={() => void submit()} />
      {!locked && (
        <DemoHint
          text={`Demo account: ${DEMO.email}`}
          action={{
            label: "Fill in",
            onPress: () => {
              setEmail(DEMO.email);
              setPassword(DEMO.password);
            },
          }}
        />
      )}
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
        {locked ? (
          <LinkText
            label="Log in as someone else"
            onPress={() => {
              getAuthSource().session.clear();
              go("login");
            }}
          />
        ) : (
          <>
            <Text variant="body" tone="secondary">
              New to BetNG?
            </Text>
            <LinkText
              label="Create an account"
              onPress={() => {
                go("register");
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}

function RegisterView({ go }: ViewProps): React.JSX.Element {
  const t = useTheme();
  const [values, setValues] = useState({ displayName: "", email: "", phone: "", password: "" });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"displayName" | "email" | "phone" | "password" | "accepted", string | undefined>>>({});
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const refs = { displayName: useRef<TextInput>(null), email: useRef<TextInput>(null), phone: useRef<TextInput>(null), password: useRef<TextInput>(null) };

  const set = (key: keyof typeof values) => (text: string) => {
    setValues((v) => ({ ...v, [key]: text }));
  };

  const submit = async (): Promise<void> => {
    const next = {
      displayName: displayNameError(values.displayName),
      email: emailError(values.email),
      phone: phoneError(values.phone),
      password: passwordError(values.password, "new"),
      accepted: accepted ? undefined : "Confirm you understand this is a simulation.",
    };

    setErrors(next);
    setFailure(undefined);

    for (const key of ["displayName", "email", "phone", "password"] as const) {
      if (next[key] !== undefined) return refs[key].current?.focus();
    }
    if (next.accepted !== undefined) return;

    setBusy(true);

    try {
      const phone = values.phone.trim();
      const pending = await getAuthSource().register({
        email: values.email.trim(),
        password: values.password,
        displayName: values.displayName.trim(),
        ...(phone === "" ? {} : { phone }),
      });

      go("verify", pending.email);
    } catch (cause) {
      setFailure(cause);
      if (cause instanceof DataSourceError && cause.code === "CONFLICT") refs.email.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <ErrorBanner error={failure} onRetry={() => void submit()} />
      <TextField
        ref={refs.displayName}
        label="Display name"
        value={values.displayName}
        onChangeText={set("displayName")}
        error={errors.displayName}
        editable={!busy}
        autoFocus
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => refs.email.current?.focus()}
      />
      <TextField
        ref={refs.email}
        label="Email"
        value={values.email}
        onChangeText={set("email")}
        error={errors.email}
        editable={!busy}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => refs.phone.current?.focus()}
      />
      <TextField
        ref={refs.phone}
        label="Phone (optional)"
        value={values.phone}
        onChangeText={set("phone")}
        error={errors.phone}
        editable={!busy}
        placeholder="+234 …"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => refs.password.current?.focus()}
      />
      <TextField
        ref={refs.password}
        label="Password"
        secure
        value={values.password}
        onChangeText={set("password")}
        error={errors.password}
        hint="At least 8 characters."
        editable={!busy}
        textContentType="newPassword"
        autoComplete="new-password"
        returnKeyType="done"
      />
      <View style={{ gap: 4 }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted, disabled: busy }}
          accessibilityLabel="I understand BetNG is a simulation with play-money only"
          disabled={busy}
          onPress={() => {
            setAccepted((v) => !v);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: t.radius.xs,
              borderWidth: 1.5,
              alignItems: "center",
              justifyContent: "center",
              borderColor: accepted ? t.colors.brand : errors.accepted !== undefined ? t.colors.danger : t.colors.borderStrong,
              backgroundColor: accepted ? t.colors.brand : "transparent",
            }}
          >
            {accepted && <Check size={14} color={t.colors.textOnBrand} strokeWidth={3} />}
          </View>
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            I understand BetNG is a simulation. Balances, stakes and returns are play-money.
          </Text>
        </Pressable>
        {errors.accepted !== undefined && (
          <Text variant="caption" tone="danger">
            {errors.accepted}
          </Text>
        )}
      </View>
      <Button label="Create account" size="lg" loading={busy} onPress={() => void submit()} />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
        <Text variant="body" tone="secondary">
          Already have an account?
        </Text>
        <LinkText
          label="Log in"
          onPress={() => {
            go("login");
          }}
        />
      </View>
    </View>
  );
}

function VerifyView({ go, done, email }: ViewProps): React.JSX.Element {
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown((c) => c - 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [cooldown]);

  const submit = async (value: string): Promise<void> => {
    if (busy) return;

    const invalid = codeError(value);

    if (invalid !== undefined) return setFailure(new DataSourceError("VALIDATION", invalid));

    setBusy(true);
    setFailure(undefined);

    try {
      const session = await getAuthSource().verify({ email, code: value });

      done(session.user.displayName);
    } catch (cause) {
      setFailure(cause);
      if (cause instanceof DataSourceError && cause.code === "VALIDATION") setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async (): Promise<void> => {
    setFailure(undefined);

    try {
      await getAuthSource().resendVerification(email);
      setResent(true);
      setCooldown(RESEND_SECONDS);
    } catch (cause) {
      setFailure(cause);
    }
  };

  const fieldError = failure instanceof DataSourceError && failure.code === "VALIDATION" ? failure.message : undefined;

  return (
    <View style={{ gap: 16 }}>
      <Text variant="body" tone="secondary">
        We sent a 6-digit code to <Text variant="bodyStrong">{email}</Text>. It expires in 15 minutes.
      </Text>
      {fieldError === undefined && <ErrorBanner error={failure} onRetry={() => void submit(code)} />}
      <CodeField label="Verification code" length={6} value={code} onChange={setCode} onComplete={(value) => void submit(value)} error={fieldError} disabled={busy} autoFocus />
      <DemoHint text={`Demo code: ${DEMO.code}`} />
      <Button label="Verify and continue" size="lg" loading={busy} disabled={code.length !== 6} onPress={() => void submit(code)} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44 }}>
        <LinkText
          label="Use a different email"
          onPress={() => {
            go("register");
          }}
        />
        {cooldown > 0 ? (
          <Text variant="caption" tone="muted" tabular accessibilityLiveRegion="polite">
            {resent ? "Code sent. " : ""}Resend in {cooldown}s
          </Text>
        ) : (
          <LinkText label="Resend code" onPress={() => void resend()} />
        )}
      </View>
    </View>
  );
}

function ForgotView({ go }: ViewProps): React.JSX.Element {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  const submit = async (): Promise<void> => {
    const invalid = emailError(email);

    setError(invalid);
    setFailure(undefined);

    if (invalid !== undefined) return;

    setBusy(true);

    try {
      await getAuthSource().requestPasswordReset(email.trim());
      setSentTo(email.trim());
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  };

  if (sentTo !== undefined) {
    return (
      <View accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brandSubtle }}>
          <MailCheck size={24} color={t.colors.brand} />
        </View>
        <Text variant="title">Check your inbox</Text>
        <Text variant="body" tone="secondary" align="center">
          If an account exists for {sentTo}, a link to reset the password is on its way.
        </Text>
        <LinkText
          label="Back to log in"
          onPress={() => {
            go("login");
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <Text variant="body" tone="secondary">
        Enter the email you signed up with and we will send a reset link.
      </Text>
      <ErrorBanner error={failure} onRetry={() => void submit()} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error}
        editable={!busy}
        autoFocus
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
      />
      <Button label="Send reset link" size="lg" loading={busy} onPress={() => void submit()} />
      <View style={{ alignItems: "center" }}>
        <LinkText
          label="Back to log in"
          onPress={() => {
            go("login");
          }}
        />
      </View>
    </View>
  );
}

function Welcome({ name }: { readonly name: string }): React.JSX.Element {
  const t = useTheme();

  return (
    <View accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: 12, paddingVertical: 48 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.successSubtle }}>
        <CircleCheck size={28} color={t.colors.success} />
      </View>
      <Text variant="title">You are in, {name.split(" ")[0]}</Text>
      <Text variant="caption" tone="muted">
        Picking up where you left off…
      </Text>
    </View>
  );
}

export function AuthScreen(): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "Auth">>();
  const { view } = route.params;
  const reason = useAuthFlow((s) => s.intent?.reason);
  const expiredEmail = getAuthSource().session.snapshot().session?.user.email;
  const [welcome, setWelcome] = useState<string>();
  const finished = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: TITLES[view] });
  }, [navigation, view]);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", () => {
        if (!finished.current) useAuthFlow.getState().setIntent(undefined);
      }),
    [navigation],
  );

  const props: ViewProps = {
    email: route.params.email ?? "",
    go: (next, email) => {
      navigation.setParams({ view: next, ...(email === undefined ? {} : { email }) });
    },
    done: (name) => {
      setWelcome(name);
      setTimeout(() => {
        finished.current = true;

        const intent = useAuthFlow.getState().take();

        navigation.goBack();
        intent?.run?.();
      }, 650);
    },
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: t.space[4], paddingBottom: insets.bottom + t.space[8], gap: 16 }}>
        {welcome !== undefined ? (
          <Welcome name={welcome} />
        ) : (
          <>
            {reason !== undefined && (view === "login" || view === "register") && (
              <View style={{ padding: 12, borderRadius: t.radius.sm, backgroundColor: t.colors.brandSubtle }}>
                <Text variant="caption" tone="brand" style={{ fontWeight: "600" }}>
                  {reason}
                </Text>
              </View>
            )}
            {view === "expired" && (
              <Text variant="body" tone="secondary">
                For your security you were signed out. Log in again to pick up where you left off — your bet slip is untouched.
              </Text>
            )}
            {view === "login" && <LoginView key="login" {...props} />}
            {view === "expired" && <LoginView key="expired" {...props} email={expiredEmail ?? ""} locked={expiredEmail !== undefined} />}
            {view === "register" && <RegisterView {...props} />}
            {view === "verify" && <VerifyView {...props} />}
            {view === "forgot" && <ForgotView {...props} />}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

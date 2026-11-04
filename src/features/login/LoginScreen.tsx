import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldErrors, Resolver } from 'react-hook-form';
import * as v from 'valibot';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Field } from '../../components/Field';
import { SelectField } from '../../components/SelectField';
import { COUNTRIES } from '../../data/countries';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/I18nProvider';
import { loginSchema } from '../../lib/validators';
import type { LoginInput } from '../../lib/validators';
import { authService } from '../../services/authService';
import { ServiceError } from '../../services/types';
import type { AuthService, Session } from '../../services/types';

/** Validates with the valibot schema; the resolved values are the *normalised* ones. */
const resolver: Resolver<LoginInput> = async (values) => {
  const result = v.safeParse(loginSchema, values);
  if (result.success) return { values: result.output, errors: {} };
  const errors: FieldErrors<LoginInput> = {};
  for (const issue of result.issues) {
    const field = issue.path?.[0]?.key as keyof LoginInput | undefined;
    if (field && !errors[field]) errors[field] = { type: issue.type, message: issue.message };
  }
  return { values: {}, errors };
};

export function LoginScreen({ auth = authService, onLoggedIn, notice }: { auth?: AuthService; onLoggedIn: (session: Session) => void; notice?: MessageKey }) {
  const { t } = useI18n();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { fullName: '', email: '', nationality: '', passportNumber: '' },
  });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const inFlight = useRef(false);

  const submit = handleSubmit(async (values) => {
    setPending(true);
    setFailure(null);
    try {
      onLoggedIn(await auth.login(values));
    } catch (err) {
      const code = err instanceof ServiceError ? err.code : 'network';
      setFailure(code === 'network' ? 'error.network' : code === 'too_many_attempts' ? 'error.tooMany' : 'error.login');
    } finally {
      setPending(false);
    }
  });

  // The guard lives in the event handler: one submit at a time, however fast the user clicks or presses Enter.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (inFlight.current) {
      event.preventDefault();
      return;
    }
    inFlight.current = true;
    void submit(event).finally(() => {
      inFlight.current = false;
    });
  };

  const err = (field: keyof LoginInput) => {
    const key = errors[field]?.message;
    return key ? t(key as MessageKey) : undefined;
  };

  return (
    <section className="login" aria-labelledby="login-heading">
      <h2 id="login-heading" data-step-heading tabIndex={-1}>{t('login.heading')}</h2>
      {notice && (
        <p className="form__notice" role="status">
          {t(notice)}
        </p>
      )}
      <p className="login__intro">{t('login.intro')}</p>
      <form className="form" noValidate onSubmit={onSubmit}>
        <Field
          id="full-name"
          label={t('login.name')}
          hint={t('login.name.hint')}
          error={err('fullName')}
          dir="auto"
          autoComplete="name"
          spellCheck={false}
          maxLength={200}
          {...register('fullName')}
        />
        <Field
          id="email"
          label={t('login.email')}
          hint={t('login.email.hint')}
          error={err('email')}
          type="email"
          inputMode="email"
          dir="ltr"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          {...register('email')}
        />
        <SelectField
          id="nationality"
          label={t('login.nationality')}
          hint={t('login.nationality.hint')}
          placeholder={t('login.nationality.placeholder')}
          options={COUNTRIES.map(([code, name]) => [code, name] as const)}
          error={err('nationality')}
          autoComplete="country"
          {...register('nationality')}
        />
        <Field
          id="passport"
          label={t('login.passport')}
          hint={t('login.passport.hint')}
          error={err('passportNumber')}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          {...register('passportNumber')}
        />
        {failure && (
          <p className="form__alert" role="alert">
            {t(failure)}
          </p>
        )}
        <Button type="submit" busy={pending}>
          <Icon name="sign-in" />
          <span>{pending ? t('login.submitting') : t('login.submit')}</span>
        </Button>
      </form>
    </section>
  );
}

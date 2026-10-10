"use client";

import { useActionState, useTransition, type FormEvent } from "react";

/**
 * Like useActionState, but the form keeps what was typed (and the chosen
 * file) after the action: React would otherwise reset it, which loses the
 * entry when it comes back with an error.
 */
export function useFormAction<State>(
  action: (state: Awaited<State>, form: FormData) => State | Promise<State>,
  initial: Awaited<State>,
) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const [, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };

  return [state, onSubmit, pending] as const;
}

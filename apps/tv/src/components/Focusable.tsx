import { forwardRef } from "react";
import { Link, type LinkProps } from "react-router";
import { cn } from "../lib/cn";

type ButtonLike = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly to?: undefined;
  readonly autoFocusOnMount?: boolean;
};
type LinkLike = LinkProps & {
  readonly to: string;
  readonly autoFocusOnMount?: boolean;
};

export type FocusableProps = ButtonLike | LinkLike;

/* Every interactive TV element goes through here so it is discoverable by the remote and draws the focus ring. */
export const Focusable = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  FocusableProps
>(function Focusable(props, ref) {
  const { className, autoFocusOnMount, ...rest } = props;
  const classes = cn("tv-focus rounded-md", className);
  const marks = {
    "data-tv-focusable": "",
    ...(autoFocusOnMount === true ? { "data-tv-autofocus": "" } : {}),
  };

  if ("to" in rest && rest.to !== undefined) {
    return (
      <Link
        ref={ref as React.RefObject<HTMLAnchorElement>}
        tabIndex={0}
        className={classes}
        {...marks}
        {...(rest)}
      />
    );
  }

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type="button"
      tabIndex={0}
      className={classes}
      {...marks}
      {...(rest)}
    />
  );
});

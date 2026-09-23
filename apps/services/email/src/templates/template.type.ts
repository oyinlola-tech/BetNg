export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export type TemplateVariables = Readonly<Record<string, string>>;

export interface EmailTemplate {
  readonly name: string;
  /**
   * Variables whose values must never be written to the database: verification codes, reset codes and
   * one-time credentials. They are used to render and then dropped.
   */
  readonly secretVariables: readonly string[];
  readonly required: readonly string[];
  render(variables: TemplateVariables): RenderedEmail;
}

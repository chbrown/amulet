{{#animals}}
  Type: {{type}}
  -->
  {{#sound}}
    Sound: {{.}}
  {{/}}
  {{^sound}}
    [Silent]
  {{/}}
{{/}}
Keeper; {{keeper.name}}
{{#keeper.specializiation}}
  Specialization: {{.}}
{{/}}

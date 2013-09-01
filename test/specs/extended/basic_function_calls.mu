{{#status.match('owed'))}}
  <span color="red">You owe {{amount}}</span>
{{/}}
{{#status.match('paid')}}
  <span color="green">Thanks for paying {{amount}}!</span>
{{/}}

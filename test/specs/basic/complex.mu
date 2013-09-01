<h1>{{header}}</h1>
<ul>
  {{#links}}
    {{#current}}
      <li><strong>{{name}}</strong></li>
    {{/}}
    {{^current}}
      <li><a href="{{url}}">{{name}}</a></li>
    {{/}}
  {{/}}
</ul>
{{^links}}
  <p>The list is empty.</p>
{{/}}

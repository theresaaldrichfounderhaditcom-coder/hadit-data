(function(){
var DATA_URL="https://raw.githubusercontent.com/theresaaldrichfounderhaditcom-coder/hadit-data/main/oig-facility-inspections.json";
var DOMAINS=["Culture","Environment of care","Patient safety","Integrated veteran care","Veteran-centered safety net"];
var MONTHS=["Jan.","Feb.","March","April","May","June","July","Aug.","Sept.","Oct.","Nov.","Dec."];
function $(s){return document.querySelector(s)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fmt(d){var p=d.split("-");return MONTHS[+p[1]-1]+" "+(+p[2])+", "+p[0]}
function fmtUS(d){if(!d)return"";var p=d.split("/");return MONTHS[+p[0]-1]+" "+(+p[1])+", "+p[2]}
var st={q:"",state:"",theme:"",recs:"",year:"",openOnly:false,domains:{},sort:"date",dir:-1,open:{}};
var DATA=[];
function render(){
 var R=DATA,body=$("#hoig-body");
 var lo=0,hi=999;if(st.recs){var a=st.recs.split("-");lo=+a[0];hi=a[1]?+a[1]:lo}
 var rows=R.filter(function(r){
  if(st.state&&r.state!==st.state)return false;
  if(st.year&&r.date.slice(0,4)!==st.year)return false;
  if(st.theme&&r.themes.indexOf(st.theme)<0)return false;
  if(st.recs!==""&&(r.n<lo||r.n>hi))return false;
  if(st.openOnly&&!r.nOpen)return false;
  for(var d in st.domains)if(st.domains[d]&&r.domains.indexOf(d)<0)return false;
  if(st.q){var h=(r.facility+" "+r.city+" "+r.state+" "+r.recs.map(function(x){return x.text}).join(" ")+" "+r.themes.join(" ")).toLowerCase();if(h.indexOf(st.q)<0)return false}
  return true});
 var k=st.sort,dir=st.dir;
 rows.sort(function(a,b){var x=a[k],y=b[k];if(k==="themes"){x=a.themes.length;y=b.themes.length}
  var c=(typeof x==="string")?x.localeCompare(y):(x-y);return c*dir||b.date.localeCompare(a.date)});
 document.querySelectorAll("#hoig th").forEach(function(th){th.setAttribute("aria-sort",th.dataset.k===k?(dir>0?"ascending":"descending"):"none")});
 document.querySelectorAll("#hoig .bar").forEach(function(b){var on=b.dataset.t===st.theme;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on)});
 document.querySelectorAll("#hoig .st").forEach(function(b){b.classList.toggle("on",b.dataset.s===st.state)});
 document.querySelectorAll("#hoig .chip[data-d]").forEach(function(b){var on=!!st.domains[b.dataset.d];b.classList.toggle("on",on);b.setAttribute("aria-pressed",on)});
 var rs=0,ro=0;rows.forEach(function(r){rs+=r.n;ro+=r.nOpen});
 $("#hoig-count").textContent="Showing "+rows.length+" of "+R.length+" reports: "+rs+" recommendations, "+ro+" still open. Click a row for details.";
 if(!rows.length){$("#hoig-tb").innerHTML='<tr><td colspan="5" class="empty">No reports match these filters.</td></tr>';$("#hoig-cards").innerHTML='<div class="empty">No reports match these filters.</div>';return}
 $("#hoig-tb").innerHTML=rows.map(function(r){var o=!!st.open[r.url];return '<tr class="row" data-id="'+esc(r.url)+'" tabindex="0" aria-expanded="'+o+'"><td>'+fmt(r.date)+'</td><td><div class="fac">'+esc(r.facility)+'</div><div class="loc">'+esc(r.city)+'</div></td><td>'+r.state+'</td><td>'+recPill(r)+'</td><td>'+tags(r)+'</td></tr>'+(o?'<tr class="detail"><td colspan="5">'+recBlock(r)+'</td></tr>':'')}).join("");
 $("#hoig-cards").innerHTML=rows.map(function(r){return '<div class="card"><div class="top"><div><div class="fac">'+esc(r.facility)+'</div><div class="loc">'+esc(r.city)+', '+r.state+' &middot; '+fmt(r.date)+'</div></div><div>'+recPill(r)+'</div></div><div style="margin-top:6px">'+tags(r)+'</div><details><summary>Recommendations and status</summary>'+recBlock(r)+'</details></div>'}).join("");
}
function pc(n){return n===0?"p0":n<=2?"p1":n<=5?"p3":"p6"}
function recPill(r){var s='<span class="pill '+pc(r.n)+'" title="Recommendations">'+r.n+'</span>';if(r.nOpen)s+=' <span class="pill open" title="Still open">'+r.nOpen+' open</span>';return s}
function tags(r){return r.themes.length?r.themes.map(function(t){return '<span class="tag'+(t==="Repeat findings"?" rep":"")+'">'+esc(t)+'</span>'}).join(""):'<span class="loc">None</span>'}
function recBlock(r){
 var h=r.n?'<b>OIG recommendations</b><ol class="recs">'+r.recs.map(function(x){var b=x.status==="open"?'<span class="rs o">Open</span>':x.status==="closed"?'<span class="rs c">Closed'+(x.closed?" "+fmtUS(x.closed):"")+'</span>':'<span class="rs x">Closed, not implemented</span>';return '<li>'+esc(x.text)+b+'</li>'}).join("")+'</ol>':'<p>OIG made no recommendations in this report.</p>';
 return h+'<a href="'+esc(r.url)+'" target="_blank" rel="noopener">Read the OIG report'+(r.reportNumber?" ("+esc(r.reportNumber)+")":"")+'</a>'}
function build(doc){
 DATA=doc.reports.map(function(r){r.n=r.recs.length;r.nOpen=r.recs.filter(function(x){return x.status==="open"}).length;return r});
 $("#hoig-upd").textContent="Checked daily against vaoig.gov. Last update: "+fmt(doc.updated)+".";
 var N=DATA.length,tot=0,open=0,zero=0,withRecs=0,tc={},sc={},yrs={},rep=0;
 DATA.forEach(function(r){tot+=r.n;open+=r.nOpen;if(!r.n)zero++;else withRecs++;r.themes.forEach(function(t){tc[t]=(tc[t]||0)+1});sc[r.state]=(sc[r.state]||0)+1;yrs[r.date.slice(0,4)]=1;if(r.themes.indexOf("Repeat findings")>=0)rep++});
 var themes=Object.keys(tc).map(function(t){return[t,tc[t]]}).sort(function(a,b){return b[1]-a[1]||a[0].localeCompare(b[0])});
 var top=themes[0],states=Object.keys(sc).sort(),first=DATA.reduce(function(m,r){return r.date<m?r.date:m},"9999");
 var old=0;var cut=new Date();cut.setFullYear(cut.getFullYear()-1);var cutS=cut.toISOString().slice(0,10);
 DATA.forEach(function(r){if(r.date<cutS)old+=r.nOpen});
 var html='<section class="gist"><h3>The Gist</h3><ul>'+
  '<li>OIG has published '+N+' facility inspection reports since '+fmt(first)+', with '+tot+' recommendations between them. '+open+' are still open.</li>'+
  '<li>The most common problem: <b>'+esc(top[0].toLowerCase())+'</b>, flagged in '+top[1]+' of the '+withRecs+' reports that carried any recommendation.'+(top[0]==="Test result communication"?' That is the system that is supposed to tell you about an abnormal lab or scan result.':'')+'</li>'+
  '<li>'+rep+' reports tied a problem to an earlier OIG, Joint Commission, or VISN review that the facility had not kept fixed.</li>'+
  (old?'<li>'+old+' recommendations are still open more than a year after their report was published.</li>':'')+
  '</ul></section>'+
  '<section class="kpis">'+[[N,"inspection reports"],[states.length,"states and D.C."],[tot,"recommendations issued"],[open,"still open"],[zero,"reports with no recommendations"]].map(function(k){return '<div class="kpi"><b>'+k[0]+'</b><span>'+k[1]+'</span></div>'}).join("")+'</section>'+
  '<section class="grid2"><div class="panel"><h3>What inspectors keep flagging</h3><p class="sub">Number of reports with a recommendation on each issue. Click a bar to filter the list.</p><div id="hoig-themes">'+
  themes.slice(0,12).map(function(t){return '<button class="bar" type="button" data-t="'+esc(t[0])+'" aria-pressed="false"><span class="t">'+esc(t[0])+'</span><span class="track"><span class="fill" style="width:'+(t[1]/top[1]*100)+'%"></span></span><span class="n">'+t[1]+'</span></button>'}).join("")+
  '</div></div><div class="panel"><h3>Reports by state</h3><p class="sub">Click a state to filter. Number is reports published.</p><div class="states" id="hoig-states">'+
  states.map(function(s){return '<button class="st" type="button" data-s="'+s+'"><b>'+s+'</b><i>'+sc[s]+'</i></button>'}).join("")+'</div></div></section>'+
  '<section class="filters" aria-label="Filters"><div class="frow">'+
  '<input type="search" id="hoig-q" placeholder="Search facility, city, or recommendation" aria-label="Search">'+
  '<select id="hoig-state" aria-label="State"><option value="">All states</option>'+states.map(function(s){return '<option>'+s+'</option>'}).join("")+'</select>'+
  '<select id="hoig-theme" aria-label="Issue"><option value="">All issues</option>'+themes.map(function(t){return t[0]}).sort().map(function(t){return '<option>'+esc(t)+'</option>'}).join("")+'</select>'+
  '<select id="hoig-recs" aria-label="Recommendations"><option value="">Any number of recommendations</option><option value="0">None</option><option value="1-2">1 to 2</option><option value="3-5">3 to 5</option><option value="6-99">6 or more</option></select>'+
  '<select id="hoig-year" aria-label="Year published"><option value="">Any year</option>'+Object.keys(yrs).sort().reverse().map(function(y){return '<option>'+y+'</option>'}).join("")+'</select>'+
  '<label class="chk"><input type="checkbox" id="hoig-open"> Still open only</label>'+
  '<button class="reset" id="hoig-reset" type="button">Clear filters</button></div>'+
  '<div class="chips"><span class="loc">Area with a recommendation:</span>'+DOMAINS.map(function(d){return '<button class="chip" type="button" data-d="'+d+'" aria-pressed="false">'+d+'</button>'}).join("")+'</div></section>'+
  '<div class="count" id="hoig-count" aria-live="polite"></div>'+
  '<table aria-label="Inspection reports"><thead><tr><th data-k="date" aria-sort="descending">Published</th><th data-k="facility">Facility</th><th data-k="state">State</th><th data-k="n">Recs</th><th data-k="themes">Issues flagged</th></tr></thead><tbody id="hoig-tb"></tbody></table>'+
  '<div class="cards" id="hoig-cards"></div>';
 $("#hoig-body").innerHTML=html;
 $("#hoig-themes").addEventListener("click",function(e){var b=e.target.closest(".bar");if(!b)return;st.theme=st.theme===b.dataset.t?"":b.dataset.t;$("#hoig-theme").value=st.theme;render()});
 $("#hoig-states").addEventListener("click",function(e){var b=e.target.closest(".st");if(!b)return;st.state=st.state===b.dataset.s?"":b.dataset.s;$("#hoig-state").value=st.state;render()});
 document.querySelector("#hoig .chips").addEventListener("click",function(e){var b=e.target.closest(".chip");if(!b)return;st.domains[b.dataset.d]=!st.domains[b.dataset.d];render()});
 $("#hoig-q").addEventListener("input",function(e){st.q=e.target.value.trim().toLowerCase();render()});
 $("#hoig-state").addEventListener("change",function(e){st.state=e.target.value;render()});
 $("#hoig-theme").addEventListener("change",function(e){st.theme=e.target.value;render()});
 $("#hoig-recs").addEventListener("change",function(e){st.recs=e.target.value;render()});
 $("#hoig-year").addEventListener("change",function(e){st.year=e.target.value;render()});
 $("#hoig-open").addEventListener("change",function(e){st.openOnly=e.target.checked;render()});
 $("#hoig-reset").addEventListener("click",function(){st.q="";st.state="";st.theme="";st.recs="";st.year="";st.openOnly=false;st.domains={};["#hoig-q","#hoig-state","#hoig-theme","#hoig-recs","#hoig-year"].forEach(function(s){$(s).value=""});$("#hoig-open").checked=false;render()});
 document.querySelectorAll("#hoig th").forEach(function(th){th.addEventListener("click",function(){var k=th.dataset.k;if(st.sort===k)st.dir*=-1;else{st.sort=k;st.dir=(k==="date"||k==="n"||k==="themes")?-1:1}render()})});
 var tog=function(tr){if(!tr)return;var id=tr.dataset.id;st.open[id]=!st.open[id];render()};
 $("#hoig-tb").addEventListener("click",function(e){if(e.target.closest("a"))return;tog(e.target.closest("tr.row"))});
 $("#hoig-tb").addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();tog(e.target.closest("tr.row"))}});
 render();
}
fetch(DATA_URL,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(build).catch(function(){
 $("#hoig-upd").textContent="";
 $("#hoig-body").innerHTML='<div class="empty">The inspection data did not load. Please refresh the page. If it keeps happening, tell us at founder@hadit.com.</div>'});
})();

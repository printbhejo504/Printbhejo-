(function(){
  function addFooter(){
    if(document.querySelector('.pb-footer')) return;
    var f=document.createElement('footer');
    f.className='pb-footer';
    f.innerHTML='<div class="pb-footer-inner"><div><strong>PrintBhejo</strong><span>file bhejne ka aasaan tarika</span></div><nav aria-label="Footer"><a href="/about.html">About</a><a href="/how-it-works.html">How It Works</a><a href="/faq.html">FAQ</a><a href="/security.html">Security</a><a href="/contact.html">Contact</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></nav><small>© '+new Date().getFullYear()+' PrintBhejo. All rights reserved.</small></div>';
    var s=document.createElement('style');
    s.textContent='.pb-footer{margin-top:40px;padding:28px 16px;border-top:1px solid rgba(0,0,0,.08);background:#fff;font-family:inherit}.pb-footer-inner{max-width:1100px;margin:auto;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}.pb-footer strong{display:block;font-size:18px}.pb-footer span,.pb-footer small{display:block;color:#667085;font-size:12px}.pb-footer nav{display:flex;gap:14px;flex-wrap:wrap}.pb-footer a{color:#344054;text-decoration:none;font-size:13px}.pb-footer a:hover{text-decoration:underline}@media(max-width:650px){.pb-footer-inner{align-items:flex-start;flex-direction:column}.pb-footer nav{gap:10px}}';
    document.head.appendChild(s);document.body.appendChild(f);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addFooter); else addFooter();
})();
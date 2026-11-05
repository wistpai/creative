(function(){'use strict';
  var c=window.POETRY_SITE||{};
  var valid=/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(c.submissionUrl||'');
  document.querySelectorAll('[data-submit]').forEach(function(a){
    if(valid){a.href=c.submissionUrl;a.removeAttribute('aria-disabled');a.removeAttribute('tabindex');}
    else{a.removeAttribute('href');a.setAttribute('aria-disabled','true');a.setAttribute('tabindex','-1');a.textContent='投稿功能建置中';}
  });
  if(c.igUrl==='https://www.instagram.com/paiwist/')document.querySelectorAll('[data-ig]').forEach(function(a){a.href=c.igUrl;});
})();

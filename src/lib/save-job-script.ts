// The "Save to ReWork" script. It runs in the user's own browser on the job page they have
// open (LinkedIn, Indeed, any posting), reads the title, company, location and description,
// and opens ReWork's /save page with them in the URL fragment (never sent to a server).
// Nothing is fetched and nothing is posted to another site. The Chrome extension
// (extension/) runs the same script and opens the tab itself (chrome.runtime is only
// there inside an extension).
//
// It is a plain string, not a compiled function, so what ships is exactly what the tests
// run. Rules for editing: ES2017, no comments inside (the bookmarklet is one line), no
// backticks, no "${". Site selectors change; the fallbacks (JSON-LD, page title, the largest
// "description" block, then the user's own text selection) keep it working when they do.

const SOURCE = String.raw`(function () {
  var ORIGIN = "__ORIGIN__";
  var host = location.hostname;
  function clean(s) {
    return (s || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  function textOf(el) {
    return el ? clean(el.innerText || el.textContent || "") : "";
  }
  function first(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < els.length; j++) {
        var t = textOf(els[j]);
        if (t) return t;
      }
    }
    return "";
  }
  function decode(s) {
    s = s.replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/&#x([0-9a-f]+);/gi, function (m, n) { return String.fromCharCode(parseInt(n, 16)); });
    return s.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }
  function fromHtml(html) {
    var s = String(html || "");
    if (/&lt;[a-z\/]/i.test(s)) s = decode(s);
    s = s.replace(/<li[^>]*>/gi, "\n- ").replace(/<(br|\/p|\/h[1-6]|\/div|\/ul|\/ol)[^>]*>/gi, "\n").replace(/<[^>]+>/g, "");
    return clean(decode(s));
  }
  function jsonLd() {
    var nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < nodes.length; i++) {
      try {
        var data = JSON.parse(nodes[i].textContent || "");
        var list = [].concat(data && data["@graph"] ? data["@graph"] : data);
        for (var j = 0; j < list.length; j++) {
          var x = list[j];
          if (x && [].concat(x["@type"]).indexOf("JobPosting") > -1) return x;
        }
      } catch (e) {}
    }
    return null;
  }
  function ldLocation(x) {
    var loc = [].concat(x.jobLocation || [])[0];
    var a = loc && loc.address;
    if (a && typeof a === "object") return [a.addressLocality, a.addressRegion].filter(Boolean).join(", ");
    return x.jobLocationType === "TELECOMMUTE" ? "Remote" : "";
  }
  function biggest(selector) {
    var best = "";
    var els = document.querySelectorAll(selector);
    for (var i = 0; i < els.length; i++) {
      var t = textOf(els[i]);
      if (t.length > best.length) best = t;
    }
    return best;
  }
  function underHeading() {
    var els = document.querySelectorAll("h1, h2, h3, h4, strong, span, div");
    for (var i = 0; i < els.length; i++) {
      var own = (els[i].textContent || "").trim();
      if (own.length > 30 || !/^(about the job|job description|full job description|description|about the role)$/i.test(own)) continue;
      var box = els[i].parentElement;
      while (box && textOf(box).length < own.length + 200) box = box.parentElement;
      if (box && box !== document.body) return textOf(box);
    }
    return "";
  }

  var job = { url: location.href, title: "", company: "", location: "", description: "" };
  var titleParts = document.title.split(/ [|\u2013\u2014-] /).map(function (p) { return p.trim(); });

  if (/(^|\.)linkedin\.com$/.test(host)) {
    var id = (location.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d+)/) || [])[1] || new URLSearchParams(location.search).get("currentJobId");
    if (id) job.url = "https://www.linkedin.com/jobs/view/" + id + "/";
    job.title = first([".job-details-jobs-unified-top-card__job-title h1", ".job-details-jobs-unified-top-card__job-title", ".jobs-unified-top-card__job-title", ".top-card-layout__title", ".topcard__title"]);
    job.company = first([".job-details-jobs-unified-top-card__company-name a", ".job-details-jobs-unified-top-card__company-name", ".jobs-unified-top-card__company-name", ".topcard__org-name-link", ".top-card-layout__second-subline a"]);
    job.location = first([".job-details-jobs-unified-top-card__primary-description-container .tvm__text", ".job-details-jobs-unified-top-card__bullet", ".topcard__flavor--bullet"]).split(/ \u00b7 /)[0];
    job.description = first(["#job-details", ".jobs-description__content .jobs-box__html-content", ".jobs-description-content__text", ".jobs-description__content", ".show-more-less-html__markup", ".description__text"]);
    var li = document.title.split(" | ");
    if (li.length >= 3 && li[li.length - 1].trim() === "LinkedIn") {
      job.title = job.title || li[0].replace(/^\(\d+\)\s*/, "").trim();
      job.company = job.company || li[1].trim();
    }
  } else if (/(^|\.)indeed\.[a-z.]+$/.test(host)) {
    var jk = new URLSearchParams(location.search).get("jk") || new URLSearchParams(location.search).get("vjk");
    if (jk) job.url = location.origin + "/viewjob?jk=" + encodeURIComponent(jk);
    job.title = first(['[data-testid="jobsearch-JobInfoHeader-title"]', ".jobsearch-JobInfoHeader-title", 'h2[data-testid="simpler-jobTitle"]']).replace(/\s*-\s*job post$/i, "");
    job.company = first(['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]', ".jobsearch-CompanyInfoContainer a", ".jobsearch-InlineCompanyRating div"]);
    job.location = first(['[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]', '[data-testid="jobsearch-JobInfoHeader-companyLocation"]']);
    job.description = first(["#jobDescriptionText", ".jobsearch-JobComponent-description"]);
  }

  var ld = jsonLd();
  if (ld) {
    job.title = job.title || clean(ld.title || ld.name || "");
    var org = ld.hiringOrganization;
    job.company = job.company || clean(typeof org === "string" ? org : (org && org.name) || "");
    job.location = job.location || ldLocation(ld);
    if (job.description.length < 200) job.description = fromHtml(ld.description) || job.description;
  }

  if (!job.title) job.title = first(["h1"]) || titleParts[0] || "";
  if (!job.company) {
    var site = document.querySelector('meta[property="og:site_name"]');
    job.company = (site && clean(site.getAttribute("content") || "")) || "";
  }
  if (job.description.length < 200) {
    var block = biggest('[id*="description" i], [class*="description" i], [id*="job-details" i], [class*="jobDescription"], [class*="job-description"]');
    if (block.length > job.description.length) job.description = block;
  }
  if (job.description.length < 200) {
    var near = underHeading();
    if (near.length > job.description.length) job.description = near;
  }

  var picked = clean(String(window.getSelection ? window.getSelection() : ""));
  if (picked.length >= 200) job.description = picked;
  job.description = job.description.replace(/^(About the job|Job description|Full job description)\s*\n/i, "");

  if (job.description.length < 50) {
    alert("ReWork couldn't find a job description on this page. Select the description text, then click Save to ReWork again.");
    return;
  }
  for (var k in job) job[k] = job[k].slice(0, k === "description" ? 20001 : 2000);
  var target = ORIGIN + "/save#job=" + encodeURIComponent(JSON.stringify(job));
  if (window.chrome && chrome.runtime && chrome.runtime.id) {
    chrome.runtime.sendMessage({ open: target });
    return;
  }
  var opened = window.open(target, "_blank");
  if (!opened) location.href = target;
})();`

/** The script for one ReWork origin, as readable source (tests run this). */
export function saveJobScript(origin: string): string {
  return SOURCE.replace('__ORIGIN__', origin.replace(/[^a-zA-Z0-9:/._-]/g, ''))
}

/** The bookmarklet link: the script on one line, percent-encoded. */
export function saveJobBookmarklet(origin: string): string {
  const oneLine = saveJobScript(origin)
    .split('\n')
    .map((line) => line.trim())
    .join(' ')
  return `javascript:${encodeURIComponent(oneLine)}`
}

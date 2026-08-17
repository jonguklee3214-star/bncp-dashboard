/* 자재 마스터 API — materials2.js(사용자 최종본) 위에 얹는 조회 계층
   공종그룹 → 세부공종 → 자재  구조로 공종선택 시 자재만 거른다. */
(function () {
  'use strict';
  var A = window.APP; if (!A) return;
  var M2 = window.BNCP_MAT2 || { items: [] };
  A.MAT2 = M2.items;

  // 공종그룹 목록
  A.matGroups = function () {
    var o = [], seen = {};
    M2.items.forEach(function (x) { if (!seen[x.grp]) { seen[x.grp] = 1; o.push(x.grp); } });
    return o;
  };
  // 그룹 안 세부공종
  A.matSubs = function (grp) {
    var o = [], seen = {};
    M2.items.forEach(function (x) {
      if (x.grp !== grp) return;
      if (!seen[x.sub]) { seen[x.sub] = 1; o.push(x.sub); }
    });
    return o;
  };
  // 세부공종의 자재만
  A.matItems = function (grp, sub) {
    return M2.items.filter(function (x) {
      return x.grp === grp && (!sub || x.sub === sub);
    });
  };
  A.matIsPlant = function (grp, sub, mat, spec) {
    var f = M2.items.filter(function (x) {
      return x.grp === grp && x.sub === sub && x.mat === mat && (!spec || x.spec === spec);
    })[0];
    return f ? !!f.plant : false;
  };
  A.matAllNames = (function () {
    var seen = {}; M2.items.forEach(function (x) { seen[x.mat] = 1; });
    return Object.keys(seen).sort();
  })();
})();

import type { AtsType } from "@internship-radar/core";
import type { SourceAdapter } from "../types";
import { ashbyAdapter } from "./ashby";
import { careerPageAdapter } from "./career-page";
import { greenhouseAdapter } from "./greenhouse";
import { hostedJsonAdapter } from "./hosted-json";
import { leverAdapter } from "./lever";
import { simplifyAdapter } from "./simplify";
import { secondaryAdapter } from "./secondary";
import { smartRecruitersAdapter } from "./smartrecruiters";
import { workdayAdapter } from "./workday";

export const adapterRegistry: ReadonlyMap<AtsType, SourceAdapter> = new Map([
  ["greenhouse", greenhouseAdapter],
  ["lever", leverAdapter],
  ["ashby", ashbyAdapter],
  ["workday", workdayAdapter],
  ["smartrecruiters", smartRecruitersAdapter],
  ["hosted_json", hostedJsonAdapter],
  ["simplify", simplifyAdapter],
  ["secondary", secondaryAdapter],
  ["career_page", careerPageAdapter],
]);

export { ashbyAdapter, careerPageAdapter, greenhouseAdapter, hostedJsonAdapter, leverAdapter, secondaryAdapter, simplifyAdapter, smartRecruitersAdapter, workdayAdapter };

import { Hero } from "@/app/components/marketing/homepage/hero";
import { SoundFamiliar } from "@/app/components/marketing/homepage/sound-familiar";
import { HowItWorks } from "@/app/components/marketing/homepage/how-it-works";
import { Surfaces } from "@/app/components/marketing/homepage/surfaces";
import { PipelineStages } from "@/app/components/marketing/homepage/pipeline-stages";
import { LogoWall } from "@/app/components/marketing/homepage/logo-wall";
import { Metrics } from "@/app/components/marketing/homepage/metrics";
import { CaseStudy } from "@/app/components/marketing/homepage/case-study";
import { WhatAbout } from "@/app/components/marketing/homepage/what-about";
import { Proof } from "@/app/components/marketing/homepage/proof";
import { Closing } from "@/app/components/marketing/homepage/closing";
import { Rail } from "@/app/components/marketing/homepage/rail";

/**
 * Tribora marketing homepage.
 *
 * Narrative (locked to tasks/messaging.md v2):
 *   §00 HERO         — "Stop answering the same question forty times."
 *   §01 PAIN         — four customer-voice quotes the buyer recognizes
 *   §02 HOW          — Record · Organize · Teach (three plain steps)
 *   §03 PLACES       — four places your team uses it (§A–§D)
 *   §04 ENGINE       — the pipeline under the hood (for the technical reader)
 *   §05 OUTCOMES     — quantified outcomes
 *   §06 CASE         — featured customer plate
 *   §07 OBJECTIONS   — adoption + security ("what about…?")
 *   §08 SECURITY     — the security brief (for the IT reviewer)
 *   §09 DEMO         — book a demo
 *
 * Source of truth: tasks/messaging.md (voice + positioning).
 * Tokens scoped under `.tribora` so the app palette stays isolated.
 */
export default function TriboraHome() {
  return (
    <>
      <Rail />
      <Hero />
      <SoundFamiliar />
      <HowItWorks />
      <Surfaces />
      <PipelineStages />
      <LogoWall />
      <Metrics />
      <CaseStudy />
      <WhatAbout />
      <Proof />
      <Closing />
    </>
  );
}

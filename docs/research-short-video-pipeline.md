# Short-form video pipeline: primary-source notes

Researched 2026-11-03. Every factual claim below is tied to a first-party page (official docs, product or policy page, or the project's own GitHub README). Where a page shows a date, it is noted. Where it does not, the citation is marked **no date on page**. If a capability is absent from the pages checked, this note says **not verified on a first-party page** instead of inferring it.

Scope of the product this note is measuring against: pick trending or hard-to-believe facts from forums, other videos, and similar sources; make a finished short (voiceover, stock, generated images or video, motion graphics, captions, edit); upload to YouTube as private or unlisted so a person can approve before it is public.

---

## 1. End-to-end commercial products

### InVideo

Documented workflow starts from an idea, script, audience, and length. The faceless-video page says InVideo AI generates a script from a prompt, selects from "16m+ stock images and videos," produces a voiceover (male or female, language and accent), and adds background music and transitions (**no date on page**): [invideo.io/make/ai-faceless-video-generator](https://invideo.io/make/ai-faceless-video-generator/). The same page says the workflow "ends with reviewing and exporting the video" and "You choose where to upload it." The YouTube-automation page says the same boundary in its own words: "Export your finished file and upload it to YouTube; channel management and publishing remain separate steps" (**no date on page**): [invideo.io/make/youtube-automation](https://invideo.io/make/youtube-automation/). The Shorts page: "This workflow ends with a downloadable video. Upload it through your YouTube account" (**no date on page**): [invideo.io/make/ai-youtube-shorts-generator](https://invideo.io/make/ai-youtube-shorts-generator/).

InVideo MCP lets an external agent open a project, bring media in, edit the timeline, and export. It does not describe a YouTube upload (**no date on page**): [help.invideo.io MCP article](https://help.invideo.io/en/articles/11316042-connect-your-ai-agent-to-invideo-mcp-server).

- Trend ingestion from forums or other videos: **not verified on a first-party page**. Documented input is a brief, script, or footage the user supplies.
- Upload to YouTube as private or unlisted: the product does not upload. Privacy status is therefore outside its documented workflow.
- Human approval gate before a YouTube publish: there is an editor review before export. There is no YouTube publish step to gate.
- Does not do: publish or schedule to a YouTube channel; manage the channel; documented trend sourcing.

Pricing: **not verified on a first-party page** in this pass.

### Fliki

The API generates a video from a script, an idea, or a blog URL. `POST https://api.fliki.ai/v1/generate/video` with `Authorization: Bearer`. `workflowType` is `script`, `idea`, or `url`. `aspectRatio` is `16:9`, `9:16`, or `1:1`. `visuals` is `stock`, `ai`, or `library`. Optional `aiVideoModel` fills a percentage of scenes with AI video clips (default `aiVideoClipPercentage` 20). Duration is 1–15 minutes, subject to the plan's max export length. Subtitle presets and karaoke-style word highlight exist. Generation is async: poll `GET /v1/generate/status?fileId=` until `success`, then use the CDN `download` URL (**no date on page**): [developer.fliki.ai video](https://developer.fliki.ai/docs/api/generate/video), [status](https://developer.fliki.ai/docs/api/generate/status).

The YouTube product page says you can connect a channel and publish or schedule from Fliki, with title, description, tags, and thumbnail filled in the tool, or download the MP4 (**no date on page**): [fliki.ai YouTube video maker](https://fliki.ai/use-cases/content-creation/youtube-video-maker). Fliki's own v5 post says publish-from-Fliki plus "auto-scheduling in Series" can "plan, produce, and publish an entire month of YouTube content without ever leaving Fliki" (**no date on page**): [fliki.ai/blog/Fliki-v5](https://fliki.ai/blog/Fliki-v5).

- Trend ingestion: **not verified on a first-party page**. API inputs are script, idea prompt, or URL.
- YouTube `privacyStatus` private or unlisted: **not verified on a first-party page**.
- Mandatory human approval before publish: **not verified on a first-party page**. The Series post describes scheduled publishing; it does not describe a hold-until-approve queue.
- The API does not upload to YouTube. It returns a file URL.
- Does not do, on the pages above: forum or YouTube trend ingestion; a documented private/unlisted upload; a documented mandatory approval gate.

### Pictory

Pictory's YouTube page: paste a script, idea, web page, or YouTube link; it builds scenes, a voiceover (it states "170+ AI voices"), and captions; "You download the MP4 and upload it." URL-to-video accepts a YouTube link, transcribes it to a script, and makes a new video. Visuals come from "18M+ stock" assets, AI Studio, or uploads. Formats named: 16:9 and 9:16 (**no date on page**): [pictory.ai/youtube-creators](https://pictory.ai/youtube-creators). A separate editor page describes upload, silence and filler removal, captions, and download (**no date on page**): [pictory.ai/ai-youtube-video-editor](https://pictory.ai/ai-youtube-video-editor).

- Trend ingestion: **not verified on a first-party page**. A YouTube link is an input the user pastes, which is repurposing one video, not a trend feed.
- YouTube upload, private or otherwise: the documented workflow ends at MP4 download.
- Human gate: the user edits scenes and downloads. No YouTube publish step.
- Does not do: upload or schedule to YouTube; documented automatic trend sourcing.

Pricing: **not verified on a first-party page** in this pass.

### Syllaby

Faceless-video page: choose an image style, write or generate a script, generate the video, download, and share. It also says you can use your own voice or AI voices, and that a content calendar can schedule and publish to YouTube, TikTok, Facebook, Threads, and LinkedIn (**no date on page**): [syllaby.io/features/faceless-video](https://syllaby.io/features/faceless-video/).

Bulk scheduler: "Choose the topic or Let our AI suggest you topics." The documented sequence is preview, adjust scripts, generate, and schedule. After generation the options listed are Edit, Publish, Copy Link, Download, or Delete. Publish lets you pick platforms, title, and description, and optionally toggle Schedule (**no date on page**): [syllaby.io/features/bulk-scheduler](https://syllaby.io/features/bulk-scheduler/).

Pricing page, figures as printed there (**no date on page**): [syllaby.io/pricing-plan](https://syllaby.io/pricing-plan/). Starter $9/month (monthly billing only; the page says about 7 faceless videos a month; 1 GB storage). Basic $29/month billed yearly (about 38 faceless videos; 5 GB). Standard $78/month billed yearly (about 115 faceless videos; 10 GB). Premium is listed as billed yearly at about 384 faceless videos a month; the dollar amount was not captured from the page text in this pass. Credits, from the bulk-scheduler page: Idea Discovery 15 credits per idea; Faceless Video 13 credits per whole minute; Script Generation 1 credit per one-minute script; Avatar Video 50 credits per 1-minute video. The pricing page says every plan includes "Thumbnails and trending ideas," stock audio and video, a content calendar, and a video editor.

- "Trending ideas" and AI topic suggestion are documented. Ingestion of Reddit threads, forum posts, or third-party videos as sources: **not verified on a first-party page**.
- YouTube privacy private or unlisted: **not verified on a first-party page**.
- A preview-and-edit step exists before schedule. A mandatory hold that blocks publish until an explicit approval, even after the scheduled time: **not verified on a first-party page**.
- Does not do, on these pages: a documented private/unlisted YouTube upload; a documented forum crawler.

### Revid

Revid's features page says it turns a YouTube channel, social posts, news, and blogs into videos, and that it schedules and auto-publishes to YouTube, TikTok, Instagram, and X (**no date on page**): [revid.ai/features](https://www.revid.ai/features). The publishing page says YouTube scheduling covers long-form and Shorts, titles, descriptions, tags, and thumbnails (**no date on page**): [revid.ai/features/social-media-publishing](https://www.revid.ai/features/social-media-publishing).

Auto Mode, from Revid's own guide (**no date on page**): [revid.ai/blog/create-video-from-youtube](https://www.revid.ai/blog/create-video-from-youtube). A worker can watch a channel, account, subreddit, or RSS feed (a single video URL is refused). Delivery has two settings: **Review First** (default) puts each video in a list the user watches and then publishes; **Auto Queue** sends a successful run to the posting queue and requires a connected account. YouTube is connected under Settings > Integrations as "Upload Shorts and videos to a channel." The same guide says the worker runs once a day between 1 AM and 5 AM, reads the 5 latest videos, and makes 1–3 Shorts. A separate Revid post says an Auto-Mode worker can pull transcripts of related TikToks with more than 10,000 likes before writing, and that Search & Remix picks a reference from "Revid's library of about 2.77 million short-form videos" and "makes an original video" without reusing the same reference (**no date on page**): [revid.ai/blog/youtube-shorts-automation](https://www.revid.ai/blog/youtube-shorts-automation). That post also states Growth is $39/month with 2,000 credits and 3 workers. Treat the library size and the TikTok-like threshold as Revid's own product claims on that post, not as independently measured figures.

- Trend-like inputs that are documented: a subreddit or RSS URL as a worker source; a channel to repurpose; an internal short-form library. A general "hard-to-believe facts" crawler across arbitrary forums: **not verified on a first-party page**.
- YouTube privacy private or unlisted: **not verified on a first-party page**.
- Human gate: Review First is a real hold-until-the-user-publishes step, and it is the default. Auto Queue removes that hold.
- Does not do, on these pages: a documented `privacyStatus=private` upload; a guarantee that Auto Queue waits for a person.

### AutoShorts.ai

The homepage describes a faceless-channel product that creates and posts videos, with series, auto-post, HD, background music, and voice cloning on paid tiers. The free tier is shown as $0 and "Creates 1 video." Paid dollar amounts were not reliably present in the fetched text (**no date on page**): [autoshorts.ai](https://autoshorts.ai/).

The review guide is explicit and dated **Reviewed October 22, 2026**: [autoshorts.ai/guides/review-before-posting](https://autoshorts.ai/guides/review-before-posting). Preview and edit of script, title, images, and music are available before the scheduled time. "Review is optional: scheduled videos do not wait for an approval click." Pausing the Series stops future creation and posting. A pause does not withdraw a video already sent to TikTok, YouTube, or Instagram. The Instagram page states the same publishing model and says one Series can select one Instagram account, one TikTok account, and one YouTube channel (**no date on page**): [autoshorts.ai/instagram-reels-automation](https://autoshorts.ai/instagram-reels-automation).

- Trend ingestion from forums or other videos: **not verified on a first-party page**. Documented input is a Series topic and settings (voice, language, visual style, duration, music).
- YouTube privacy private or unlisted: **not verified on a first-party page**.
- Human approval gate: the vendor's own page says this is **not** a mandatory approval workflow.
- Does not do: hold each video until a person approves it; a documented private/unlisted upload; a documented source crawl.

### Opus Clip

Opus Clip's product page describes clipping an existing video: auto reframe, highlight selection, animated captions ("97%+ accuracy" is their claim), optional AI B-roll from stock or AI-generated visuals ("Lab version"), and a scheduler that autoposts to YouTube, TikTok, Instagram, LinkedIn, and X. New users get a 7-day Pro trial with 90 minutes of processing (**no date on page**): [opus.pro](https://www.opus.pro/home-page).

Import constraints, from the help center (**no date on page**): links must be public or unlisted; "Private videos can not be accessed" ([video sources](https://help.opus.pro/docs/article/video-sources-supported)). YouTube-link submission asks the user to verify channel ownership ([ownership](https://help.opus.pro/docs/article/youtube-ownership-verification)). Auto Import, for Pro and Starter, pulls the user's own public videos longer than 3 minutes, not Shorts, livestreams, private, or unlisted. Processing can be "Notify me via Email" (the user decides whether to clip) or "Auto create projects" ([auto import](https://help.opus.pro/docs/article/auto-import)).

- This product starts from footage the user already has. It does not document generating a narrated fact video from a topic.
- Trend sourcing: the homepage says clips are chosen using "social and marketing trends." A feed of forum facts or unrelated videos: **not verified on a first-party page**.
- Outbound YouTube privacy private or unlisted: **not verified on a first-party page**.
- Human gate on the outbound post: **not verified on a first-party page**. Email notify is a gate on whether to clip, not on the YouTube privacy of a later post.
- Does not do: create the source video; import private YouTube videos; a documented private draft upload for approval.

### Vizard

Vizard's YouTube editor page: paste a YouTube link or upload, edit by transcript, ask for Shorts, then "publish your videos directly to YouTube" via "Publish to YouTube" (**no date on page**): [vizard.ai/tools/youtube-video-editor](https://vizard.ai/tools/youtube-video-editor). The content calendar schedules TikTok, Instagram Reels, YouTube, YouTube Shorts, Facebook, LinkedIn, and X, and generates descriptions and hashtags the user can edit (**no date on page**): [vizard.ai/tools/content-calendar](https://vizard.ai/tools/content-calendar). AI Studio on the editor page "generates footage and images" and "text to motion graphics" inside the editor.

Publish API: `POST https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/publish-video` with header `VIZARDAI_API_KEY`. Body fields include `finalVideoId` or `videoUrl`, `socialAccountId`, `post`, `title`, and optional `publishTime`. "If `publishTime` is not provided, the video will be published immediately." YouTube limits stated there: post 5,000 characters, title 100 (**no date on page**): [docs.vizard.ai publish](https://docs.vizard.ai/docs/publish-clips-to-social-media).

- Core job is clipping and editing a video you supply. Motion graphics and generated footage are editor features, not a documented facts-to-short pipeline.
- Trend ingestion: **not verified on a first-party page**.
- YouTube privacy private or unlisted: **not verified on a first-party page**. The publish API has no privacy field in the documented parameters, and omitting `publishTime` publishes immediately.
- Human gate: the web app is a click-to-publish flow. The API can publish with no delay.
- Does not do: a documented source-of-facts stage; a documented private/unlisted hold.

### HeyGen

HeyGen's API returns an MP4. It does not document a YouTube upload. Auth header is `X-Api-Key` (**no date on page**): [developers.heygen.com quick start](https://developers.heygen.com/docs/quick-start).

Two generation shapes:

- Avatar video: `POST /v3/videos`. An avatar or photo speaks a script or audio with lip-sync. `output_format` `mp4` or `webm` (webm is transparent and requires an avatar that supports matting) (**no date on page**): [create video](https://developers.heygen.com/reference/create-video).
- Scene generation: `POST /v3/models/videos` with model `heygen-video-1`, modes `text_to_video`, `image_to_video`, or `reference_to_video`. Duration is whole seconds from 5 through 30, or `auto` (default 5). Resolution `480p`, `768p`, `1080p`, or `2k`. Returns 202 and a `video_id` to poll (**no date on page**): [create HeyGen video](https://developers.heygen.com/reference/create-heygen-video).
- Video Agent: `POST /v3/video-agents` with a prompt. `mode` `generate` is one-shot; `mode` `chat` "pauses for review and supports revisions." Poll the session, then `GET /v3/videos/{video_id}` for `video_url`. The docs say processing is typically 5–10× the video length (**no date on page**): [video agent](https://developers.heygen.com/docs/video-agent).

- Trend sourcing: **not verified on a first-party page**.
- YouTube upload of any privacy: **not verified on a first-party page**.
- Human gate: `chat` mode pauses the agent for review of the video being made. That is not a YouTube approval gate.
- Does not do: stock-footage assembly of a fact short; YouTube publish; documented trend ingestion. `heygen-video-1` clips are 5–30 seconds, so a full Short is multiple clips or a different workflow (the avatar/Video Agent path can be a whole presented video).

### Synthesia

Synthesia's Video API creates finished avatar videos, dubs, translations, and template renders. It is async (poll or webhook). Interactive Avatars are a live stream, not a file (**no date on page**): [docs.synthesia.io introduction](https://docs.synthesia.io/reference/introduction). Create-video auth uses a key with the `Legacy (v2)` scope in the `Authorization` header. A test video is watermarked and does not count toward quota. `visibility` is `private` or `public`, and the docs define that as the Synthesia share page, not YouTube: public means the share page is active; private means visitors get 404 and download is a time-limited link. Aspect ratios include `16:9` and `9:16` (**no date on page**; the reference pages say "Updated about 2 months ago" relative to fetch time, so roughly September 2026): [quickstart](https://docs.synthesia.io/reference/synthesia-api-quickstart), [create a video](https://docs.synthesia.io/reference/create-video). Templates take `templateId` plus `templateData` variable substitutions ([create from template](https://docs.synthesia.io/reference/create-a-video-from-a-template)).

- Trend sourcing: **not verified on a first-party page**.
- YouTube upload: **not verified on a first-party page**.
- The `visibility` field is the Synthesia share page.
- Does not do: stock or motion-graphics fact videos as the documented product; YouTube private upload; trend ingestion. Input is a script, avatar, and background, or a template.

### What this set does not cover as one product

Across the first-party pages above, no listed product documents all three of: ingest facts from forums and other videos, assemble the full short (voice, stock, generated media, motion graphics, captions), and upload to YouTube specifically as private or unlisted for a human to approve. Closest partials: Revid Review First holds a generated or clipped video until the user publishes, but private/unlisted is not documented. AutoShorts, Fliki Series, Syllaby, Opus, and Vizard can publish or schedule, and AutoShorts states that review is not required. InVideo and Pictory stop at a file. HeyGen and Synthesia return a rendered file and center on a presenter or avatar.

---

## 2. Open-source pipelines

### MoneyPrinterTurbo

Repo: [github.com/harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo). License: MIT, copyright 2024 Harry ([LICENSE](https://github.com/harry0703/MoneyPrinterTurbo/blob/main/LICENSE)). English README blob view showed a commit date of 28 Oct 2026: [README-en.md](https://github.com/harry0703/MoneyPrinterTurbo/blob/HEAD/README-en.md).

Stages the README says it implements: topic or keyword to script (or a user-supplied script); voiceover; footage match; subtitles; background music; HD compose. Footage sources named: local uploads, Pexels, Pixabay, Coverr, and "Shengsuan Cloud AI Video" clips combined with the project's voiceover and subtitles. Voice providers named: Edge TTS (no API key), Azure Speech, SiliconFlow, Google Gemini, Xiaomi MiMo, MiniMax, ElevenLabs, Chatterbox, Kokoro, Fish Audio, ModelBest VoxCPM, and others. Subtitles: `edge` mode uses TTS timestamps; `whisper` mode uses local `faster-whisper` (default model called `large-v3`, about 3 GB). The README also lists "Publish completed videos directly to TikTok, Instagram, and YouTube Shorts." A separate note on the revision-aware CLI says that path "makes no provider calls or automatic posts."

- Forum trend ingestion: **not verified** in that README.
- YouTube `privacyStatus` private or unlisted, and a hold for human approval: **not verified** in that README.
- The README warns that some default music "includes some default music from YouTube videos" and says to delete it if there are copyright issues.

### ShortGPT

Repo: [github.com/RayVentura/ShortGPT](https://github.com/RayVentura/ShortGPT). License: MIT, copyright 2024 Ray Ventura ([LICENSE on stable](https://github.com/RayVentura/ShortGPT/blob/stable/LICENSE)). The GitHub file list showed `README.md` last updated 19 Sep 2024.

README stages ([README on stable](https://github.com/RayVentura/ShortGPT/blob/stable/README.md)): LLM-oriented editing language; scripts and prompts; voiceover via EdgeTTS in 30+ languages; caption generation; image and video sourcing "from the internet, connecting with the web and Pexels API"; TinyDB persistence. Engines named:

- `ContentShortEngine` — shorts from script generation through render, "including adding YouTube metadata."
- `ContentVideoEngine` — longer videos: audio, background footage, caption timing, background assets.
- `ContentTranslationEngine` — transcribe, translate, re-voice, caption.
- `EditingEngine` — editing markup and JSON blocks.

- YouTube metadata is documented. A YouTube Data API upload, privacy status, or approval gate: **not verified** in that README.
- Trend ingestion: **not verified** in that README.
- Assembly is in-process (the README's editing engine), not a hosted render API.

### MoneyPrinter (FujiwaraChoki)

Repo: [github.com/FujiwaraChoki/MoneyPrinter](https://github.com/FujiwaraChoki/MoneyPrinter). License: MIT, copyright 2024 FujiwaraChoki ([LICENSE](https://raw.githubusercontent.com/FujiwaraChoki/MoneyPrinter/master/LICENSE)). README: topic in, YouTube Short out, MoviePy, "Ollama-first" for script and metadata, and a DB-backed queue (API + worker + Postgres in Docker) "for reliable, restart-safe processing" (**no date on the fetched README text**): [README](https://github.com/FujiwaraChoki/MoneyPrinter).

- Trend ingestion, YouTube privacy, and an approval gate: **not verified** in that README. The README describes generation, not the upload call.

### MoneyPrinterPro

Repo: [github.com/ahmadhozien/money-printer-pro](https://github.com/ahmadhozien/money-printer-pro). The README says GNU Affero General Public License v3.0, "the same license as the upstream project," and that a modified version distributed or run as a network service must be made available under AGPL-3.0. It says it is built on FujiwaraChoki/MoneyPrinterV2.

Stages the README lists: LLM script, TTS voiceover, AI images or stock footage, MoviePy composite with word-by-word subtitles, Selenium upload to YouTube Shorts and TikTok, a built-in scheduler, and "Trend discovery — pull trending / high-engagement titles from Reddit & YouTube." Also a Streamlit GUI for preview and scene edits. Providers named include OpenAI, OpenRouter, Pixabay, and others.

- This README is the only project page in this set that states both Reddit/YouTube title discovery and a YouTube upload.
- `privacyStatus` private or unlisted: **not verified** in that README.
- A hold that blocks the Selenium upload until a person approves: **not verified** in that README. The GUI can preview and edit scenes; the scheduler is described as schedulable upload.

### NarratoAI

Repo: [github.com/linyqh/NarratoAI](https://github.com/linyqh/NarratoAI). GitHub lists MIT. The README describes a film-commentary tool: LLM script, automated cut, dub, and subtitles for an existing video, and says the project was rebuilt from MoneyPrinter and MoneyPrinterTurbo.

- It starts from a video to narrate. Topic-to-stock fact shorts, trend APIs, and YouTube private upload: **not verified** in that README.

---

## 3. Composable building blocks

### Trend and source APIs

**YouTube Data API v3.** `search.list` is `GET https://www.googleapis.com/youtube/v3/search`. `part=snippet`. `q` supports NOT (`-`) and OR (`|`). `type=video`, `videoDuration=short` (under four minutes), `order=viewCount` or `date` or `relevance`, `publishedAfter` / `publishedBefore` as RFC 3339. `maxResults` 0–50, default 5. The docs say not to use `search.list` to list a channel's newest uploads; use `playlistItems.list` on the uploads playlist, because search ordering can lag the index (**no date on the method page**; quota change is dated below): [search.list](https://developers.google.com/youtube/v3/docs/search/list).

Quota, from the calculator and the revision history: as of the **1 Jun 2026** note, `search.list` and `videos.insert` have their own buckets. Default allocation is 100 `search.list` calls, 100 `videos.insert` calls, and 10,000 units/day for all other methods. Each `search.list` and `videos.insert` call costs 1 in its own bucket. Other methods still have the older point costs (`videos.list` is 1, `videos.update` is 50). Daily quotas reset at midnight Pacific Time: [quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost), [revision history, 1 Jun 2026](https://developers.google.com/youtube/v3/revision_history). A facts pipeline that discovers videos by search is capped at 100 search calls per day per project unless Google raises that bucket.

**Reddit Data API.** Help wiki **updated 11 May 2026**: clients must use a registered OAuth token; unauthenticated traffic is blocked; User-Agent must identify the app and a Reddit username. Free-tier rate limit: 100 queries per minute per OAuth client id, averaged over a 10-minute window. Response headers `X-Ratelimit-Used`, `X-Ratelimit-Remaining`, `X-Ratelimit-Reset`: [Reddit Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki). Technical endpoint reference linked from that wiki: [reddit.com/dev/api](https://www.reddit.com/dev/api/).

Data API Terms, effective 19 Jun 2023, **last revised 20 Jul 2026**: section 3.1 says commercial use, research above rate limits, or any use not expressly permitted requires a separate agreement with Reddit. Section 3.2 prohibits using User Content to train a machine-learning or AI model without express permission of the rightsholders, and prohibits selling or deriving revenue from the Data APIs without express written approval: [Data API Terms](https://redditinc.com/policies/data-api-terms). App registration page: unregistered Data API apps start losing access **12 Jan 2027**; "Remaining public API access will end in March 2027": [developers.reddit.com/app-registration](https://developers.reddit.com/app-registration).

**Google Trends.** Google's own page documents a Trends API alpha, not a generally available public API. Access is an application. Stated contents: a rolling 5-year window; daily, weekly, monthly, and yearly aggregation; country and sub-region comparison; data that is not scaled 0–100, so terms can be merged across requests. The same page says the Trends website UI compares eight terms at a time (**no date on page**): [developers.google.com/search/apis/trends](https://developers.google.com/search/apis/trends).

**Wikipedia.** MediaWiki's action API can return plain-text extracts via the TextExtracts extension, and full wikitext via `prop=revisions` with `rvprop=content`, or via `action=raw` (**no date on page**): [API:Get the contents of a page](https://www.mediawiki.org/wiki/API:Get_the_contents_of_a_page). Search is `list=search` with required `srsearch`; `srlimit` default 10, max 500 (**no date on page**): [API:Search](https://www.mediawiki.org/wiki/API:Search). The REST search path is `GET /search/page?q=` (**no date on page**): [REST API reference](https://www.mediawiki.org/wiki/API:REST_API/Reference).

### Script / LLM

This stage is a commodity HTTP chat completion. No vendor is selected here. YouTube's own disclosure examples list "using generative AI tools to create or improve a video outline, script, thumbnail, title, or infographic" and "Idea generation" among edits that creators do not have to disclose: [Disclosing use of GenAI content](https://support.google.com/youtube/answer/14328491).

### Voice: ElevenLabs

`POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps` returns `audio_base64` plus `alignment` and `normalized_alignment`. Each alignment object has `characters`, `character_start_times_seconds`, and `character_end_times_seconds` (**no date on page**): [convert with timestamps](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps). A streaming variant exists at `.../stream/with-timestamps`: [stream with timestamps](https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps).

For audio that already exists, `POST /v1/forced-alignment` (multipart `file` and `text`) returns per-character and per-word `start` and `end` in seconds plus a `loss` score. The reference page caps that file at 1 GB. The capability overview says pricing matches Speech to Text, maximum file 3 GB, maximum audio 10 hours, maximum text 675,000 characters, and that diarization is not supported (**no date on page**; the two pages disagree on the file-size cap, so both figures are recorded as printed): [forced alignment reference](https://elevenlabs.io/docs/api-reference/forced-alignment/create), [forced alignment overview](https://elevenlabs.io/docs/overview/capabilities/forced-alignment). Auth on the documented curl is the `xi-api-key` header. Pricing table: **not fetched in this pass**; do not invent a rate.

### Stock: Pexels and Pixabay

**Pexels.** `GET https://api.pexels.com/v1/videos/search` with header `Authorization: <key>`. Required `query`. Optional `orientation` (`landscape`, `portrait`, `square`), `size` (`large` 4K, `medium` Full HD, `small` HD), `locale`, `page` (default 1), `per_page` (default 15, max 80). Default rate limit printed in the API docs: 200 requests per hour and 20,000 per month. Headers `X-Ratelimit-Limit`, `X-Ratelimit-Remaining`, `X-Ratelimit-Reset` appear on 2xx only. The docs say higher limits are free if the integration meets their terms and shows attribution (**no date on page**): [pexels.com/api/documentation](https://www.pexels.com/api/documentation/). The marketing API page says "New API key issuance is currently paused and cannot be requested," and asks for credit such as "Photos provided by Pexels" (**no date on page**): [pexels.com/api](https://www.pexels.com/api/).

**Pixabay.** `GET https://pixabay.com/api/videos/` with required `key` query parameter. Optional `q` (max 100 characters), `video_type` (`all`, `film`, `animation`), `category` (includes `science` and `education`), `order` (`popular` or `latest`), `safesearch`, `per_page` 3–200 (default 20). Rate limit: 100 requests per 60 seconds per key. Docs say responses must be cached 24 hours and "Systematic mass downloads are not allowed." `totalHits` is capped at 500 videos per query. The API is described as free; the docs ask users of the API to show where the media came from (**no date on page**): [pixabay.com/api/docs](https://pixabay.com/api/docs/).

### Image and video generation

These APIs return a clip of a few seconds. In this product they are scene or b-roll generators. A finished Short with a continuous voiceover, captions, and music is an assembly step (section below), unless the chosen model is itself the whole presenter (HeyGen, Synthesia).

**FLUX, Black Forest Labs.** Current video endpoint `POST https://api.bfl.ai/v1/flux-3-video`, header `x-key`. Modes: `t2v` (prompt), `i2v` (keyframes: one image, a start and end, or up to ten timestamped frames), `v2v` (continue a clip from `start_video`). `duration` is whole seconds 5–20, or `auto`. `aspect_ratio` includes `9:16` and `16:9`. `generate_audio` defaults on. Async: the POST returns `polling_url`; poll until `status` is `Ready`; the MP4 is `result.sample`. BFL's agent brief says that URL expires after 10 minutes and should be copied to your own storage. Image generation is a different endpoint, `/v1/flux-3-image`. Edit is `/v1/flux-tools/video-edit-v1`. BFL says FLUX 3 Max is hosted at fal.ai and is not an `api.bfl.ai` endpoint. Pricing is credits on [bfl.ai/pricing](https://bfl.ai/pricing); this note does not quote a number (**video page has no date**): [docs.bfl.ai/flux_3/flux3_video](https://docs.bfl.ai/flux_3/flux3_video), [bfl.ai/llms.txt](https://bfl.ai/llms.txt).

**fal.** BFL's own brief points FLUX 3 Max to [fal.ai/flux-3-max](https://fal.ai/flux-3-max). fal's page for the older image model `fal-ai/flux-pro/v1.1` uses `FAL_KEY` and `fal.subscribe` / `fal.queue.submit` (**no date on page**): [fal.ai flux-pro v1.1 API](https://fal.ai/models/fal-ai/flux-pro/v1.1/api). A current fal video-model matrix was **not verified** beyond BFL's pointer.

**Runway.** Runway Dev's docs homepage describes one API for Runway models and partner models including Kling (**no date on the snippet**): [docs.dev.runwayml.com](https://docs.dev.runwayml.com/). Changelog: Gen-4.5, text-to-video and image-to-video, durations 2–10 seconds (entry dated 10 Feb 2026). Gemini Omni Flash on Runway (`gemini_omni_flash`): text and image to video, 3–10 seconds, 720p, landscape `1280:720` or portrait `720:1280` (entry dated 1 Jul 2026): [API changelog](https://docs.dev.runwayml.com/api-details/api_changelog/). Pricing page: credits are purchased at $0.01 per credit in the developer portal; per-model credit rates are listed on that page (for example Kling 4.0 rates, with a discount the page says runs through 30 Nov 2026 UTC). Auth header details: **not copied from a fetched reference page in this pass**. [pricing](https://docs.dev.runwayml.com/guides/pricing).

**Kling.** Official text-to-video for Kling 4.0: `POST https://api-singapore.klingai.com/text-to-video/kling-4.0`, `Authorization: Bearer`. `settings.duration` integers 3 through 30, default 10. `settings.resolution` `720p` or `1080p` (default `1080p`). `settings.aspect_ratio` includes `9:16` and `16:9`. Response `data.status` is `submitted`, `processing`, `succeeded`, or `failed`. Optional `options.callback_url`. Watermark generation is optional and off by default. The prompt notes say the model can take referenced images and video (**page shows no publication date**): [kling.ai text-to-video 4.0](https://kling.ai/document-api/api/video/4-0/text-to-video.md). Role: a generated clip of at most 30 seconds, used as b-roll or a scene, not the assembled Short.

**Google Veo and Gemini Omni.** The Veo 3.1 Gemini API page says preview model IDs `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, and `veo-3.1-lite-generate-preview` **were shut down on 22 Oct 2026**, and tells developers to migrate to Gemini Omni Flash (`gemini-omni-1.1-flash`) or GA models on Gemini Enterprise Agent Platform: [ai.google.dev/gemini-api/docs/veo](https://ai.google.dev/gemini-api/docs/veo). Omni Flash model page, **latest update August 2026**: input text, image, and video (up to 10s for editing and extension); output video 3–10 seconds at 360p, 720p, 1080p, or 4K, 24 fps: [gemini-omni-flash](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash). The Omni guide says generated videos include a SynthID watermark, YouTube URLs cannot be used as a media source, and extension appends to the end of a clip only: [ai.google.dev/gemini-api/docs/omni](https://ai.google.dev/gemini-api/docs/omni). Role: short generated shots with optional native audio, then assembly elsewhere.

**OpenAI Sora.** Official guide: "The Sora 2 models and Videos API were shut down on September 24, 2026 and are no longer available. No one-to-one replacement API is available." Deprecations table lists shutdown date 2026-09-24 for the Videos API, `sora-2`, `sora-2-pro`, and the dated snapshots, recommended replacement column "---": [video generation guide](https://developers.openai.com/api/docs/guides/video-generation), [deprecations](https://developers.openai.com/api/docs/deprecations).

### Assembly

**Remotion.** React components rendered to video. `@remotion/lambda` renders on AWS Lambda: a function plus an S3 bucket, the project deployed to S3 as a site, many Lambdas rendering chunks, one function stitching, final file uploaded to S3. Documented fit: videos under about 80 minutes at Full HD before the Lambda timeout. Limits stated: 10 GB function storage, so the output file is about 5 GB maximum; default regional concurrency 1000, which AWS can raise; AV1 is not available on Lambda. `renderMediaOnLambda()` takes `region`, `functionName`, `composition`, `serveUrl`, and `codec` (`h264`, `h265`, `vp8`, `vp9`, `gif`, `prores`, plus audio codecs `mp3`, `aac`, `wav`) (**no date on page**): [remotion.dev/docs/lambda](https://www.remotion.dev/docs/lambda), [renderMediaOnLambda](https://www.remotion.dev/docs/lambda/rendermediaonlambda). License FAQ (**no date on page**): free for an individual, or an organization of up to 3 people, including commercial use and automation. Four or more people need a Company License. "Remotion for Automators" is $0.01 per render with a $100/month minimum. "Remotion for Creators" is $25/month per person who writes Remotion code. Calling `renderMediaOnLambda()` is one of the calls that counts as an automation. Remotion is source-available, not OSI open source. A Remotion license does not cover H.264 or AAC patent royalties: [license FAQ](https://www.remotion.dev/docs/license/faq).

**Shotstack.** Cloud edit from JSON. Three APIs: Edit `https://api.shotstack.io/edit/{version}`, Serve, and Ingest, same API key in the `x-api-key` header. Version `v1` is production without watermarks; `stage` is the sandbox. `POST /render` validates JSON, downloads assets, renders, and stores the file. An edit is a `timeline` plus an `output`. `POST /generate` can make one image, video, or audio asset from a prompt without a full edit (**no date on the fetched reference**): [shotstack.io/docs/api](https://shotstack.io/docs/api/).

**Creatomate.** `POST https://api.creatomate.com/v2/renders` with `Authorization: Bearer`. Body is `template_id` plus a `modifications` map (text, colors, media URLs). The template is designed in their editor. Output is a rendered video or image URL. Formats named on the developers page include MP4, JPG, PNG, and GIF (**no date on page**): [creatomate.com/developers](https://creatomate.com/developers).

**JSON2Video.** `POST https://api.json2video.com/v2/movies` with header `x-api-key`. Body is Movie JSON (`scenes` / `elements`, or a `template` id plus `variables`). The call returns a `project` id immediately; poll `GET /v2/movies?project=` until `done`, `error`, or `timeout`. Request body limit 2 MB. The POST is not idempotent. Public resources are `/movies`, `/templates`, and `/media` only (**no date on page**): [API endpoints](https://json2video.com/docs/v2/reference/api-endpoints), [create movie](https://json2video.com/docs/v2/reference/api-endpoints/movies-create).

**FFmpeg.** `ffmpeg` reads any number of inputs and writes any number of outputs: "a universal media converter" that can filter and transcode. Official command docs are regenerated nightly from trunk: [ffmpeg.org/ffmpeg-doc.html](https://ffmpeg.org/ffmpeg-doc.html), [ffmpeg.org/documentation.html](https://ffmpeg.org/documentation.html). It runs inside your own worker. It does not host renders or store files. The legal page timed out during this pass (HTTP 504), so license terms are **not verified in this note**. Remotion's FAQ points at an FFmpeg license page for codecs it redistributes: [remotion license FAQ](https://www.remotion.dev/docs/license/faq).

### YouTube upload

`videos.insert` uploads and sets metadata. `POST https://www.googleapis.com/upload/youtube/v3/videos`. Max file size 256 GB. MIME `video/*` or `application/octet-stream`. Scopes include `https://www.googleapis.com/auth/youtube.upload` (upload only) and the broader `youtube`, `youtubepartner`, and `youtube.force-ssl` scopes. Quota: 100 calls/day in the Video Uploads bucket, 1 unit each, unless raised (**method page has the quota line; the bucket split is dated 1 Jun 2026**): [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost).

`status.privacyStatus` valid values: `private`, `public`, `unlisted`. If omitted on insert, the default is `public`. Some creator-account settings can still default an upload to private. `status.publishAt` (ISO 8601) can be set only while privacy is `private`, and only if the video has never been published. Setting `publishAt` in the past publishes immediately, which is the same effect as moving `private` to `public`: [videos resource](https://developers.google.com/youtube/v3/docs/videos).

Altered or synthetic disclosure on the API: `status.containsSyntheticMedia` (boolean) on `videos.insert` or `videos.update`. Added **30 Oct 2024**. The property text says it discloses realistic altered or synthetic content, with examples: a real person appearing to say or do something they did not; altered footage of a real event or place; a realistic-looking scene that did not occur: [revision history](https://developers.google.com/youtube/v3/revision_history), [videos resource](https://developers.google.com/youtube/v3/docs/videos).

Developer policy: if an API client supports uploads, it "must clearly display an option for the user to choose" `public`, `private`, or `unlisted`, and it cannot change privacy status without the user's express consent: [developer policies](https://developers.google.com/youtube/terms/developer-policies).

Upload sample scope string: [uploading a video](https://developers.google.com/youtube/v3/guides/uploading_a_video).

---

## 4. YouTube policies that constrain this product

### Monetization: inauthentic content

This is a YouTube Partner Program monetization rule, on the channel monetization policies page. The page's banner, dated **15 Jul 2025**, says YouTube renamed "repetitious content" to "inauthentic content" and clarified that the policy includes content that is repetitive or mass-produced. It says this content was already ineligible, and that the reused-content policy is unchanged: [support.google.com/youtube/answer/1311392](https://support.google.com/youtube/answer/1311392).

Operative standard, quoted from that page:

> If you're making money on YouTube, your content should be original and "authentic." This means that we expect your content to:
>
> - Be your original creation. If you borrow content from someone else, you need to change it significantly to make it your own.
> - Not be mass-produced, generic, repetitive, or manipulative. It should be made for the enjoyment or education of viewers, rather than for the sole purpose of getting views.

Examples the same page lists as not allowed to monetize include:

- "Image slideshows, templated storylines, or scrolling text with minimal or no narrative, commentary, or educational value."
- "AI-generated content made with generic or unoriginal templates giving the impression of mass production without adding the creator's original, authentic insights or perspective."
- Under reused content: "Content that exclusively features readings of other materials you did not originally create, like text from websites or news feeds."
- The reused-content section also says the policy applies "even if you have permission from the original creator" and is separate from copyright.

The same page says automated tools are allowed when "the final product must still demonstrate your creative vision and provide educational or entertainment value," and gives as an allowed example "using AI to edit your video scripts or generate a unique background visual."

A YouTube Community reply from the same July 2025 update says the rename is not a new policy, that it applies "regardless of how the content was made," and that "channels that use AI in their content remain eligible to monetize" if the monetization policies and the disclosure requirement are followed: [Community thread](https://support.google.com/youtube/thread/356734251/response-to-creator-questions-about-ypp-policies-july-2025).

### Synthetic or altered content disclosure

Help page (**no separate publication date on the fetched article**; the creator-updates page says the altered-content setting became required in the upload flow starting 18 Mar 2024): [Disclosing use of GenAI content](https://support.google.com/youtube/answer/14328491), [creator updates](https://support.google.com/youtube/answer/9072033).

Operative rule, quoted:

> We require creators to disclose AI-generated or altered content that seems realistic.

Creators must disclose content that:

- "Makes a real person appear to say or do something they didn't do."
- "Alters footage of a real event or place."
- "Generates a realistic scene that didn't actually occur."
- "Creates music that's the main focus of the video."

Disclosure is the "AI use" control in YouTube Studio during upload, or `status.containsSyntheticMedia` on the API (section 3). The help page says: "Disclosing AI content alone won't limit a video's audience or impact its eligibility to earn money." It also says creators who consistently do not disclose "may be subject to manual application of a label, or penalties from YouTube, including removal of content or suspension from the YouTube Partner Program." YouTube may also label content from its own GenAI tools, from C2PA metadata, or from its own detectors. How viewers see the label is described at [How this content was made](https://support.google.com/youtube/answer/15447836).

Examples that page says do **not** need disclosure: non-realistic scenes, production assistance (script, title, thumbnail, idea generation), caption creation, and "Cloning one's own voice to create voice overs or dubs." Examples that do: "AI generated extra footage of a real place" and realistic depictions of events that did not happen. A photoreal generated clip of a real historical event sits on the disclose side of those examples. A cartoon or a stock-footage edit with an AI script sits on the examples they say do not need disclosure. The page says both lists are not exhaustive.

---

## 5. Infrastructure patterns for long-running media jobs

**Object storage.** Amazon S3 is "an object storage service" for "any amount of data," with lifecycle expiry and Object Lock if a retention rule is required (**no date on the overview**): [What is Amazon S3?](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html). Remotion Lambda's own design stores the site, chunk renders, metadata, and the final file in an S3 bucket, which is the documented pattern for a render that outlives the function: [remotion.dev/docs/lambda](https://www.remotion.dev/docs/lambda). BFL's result URLs expire after 10 minutes, so the caller has to copy the MP4 into its own store: [bfl.ai/llms.txt](https://bfl.ai/llms.txt). This note does not quote S3 prices.

**Queue / workflow.**

- Inngest steps: `step.run()` is retried on throw; a successful result is stored and not run again. Steps can sleep or wait without holding compute. The function runs on your compute; Inngest stores checkpoints (**no date on page**): [Inngest steps](https://www.inngest.com/docs/learn/inngest-steps), [durable workflows](https://www.inngest.com/docs/durable-execution/durable-workflows).
- Trigger.dev: durable TypeScript tasks with retries, queues, and waits. The introduction says there is no execution timeout. Core license stated there: Apache-2.0. Self-host or Trigger.dev Cloud (**no date on page**): [trigger.dev/docs/introduction](https://trigger.dev/docs/introduction).
- Temporal: a workflow is code; each execution records an event history and is restored by replay after a crash. The docs say a workflow can keep running for years if the infrastructure fails. Languages named include Go, Java, TypeScript, and Python. Workers are separate from the Temporal Server (**no date on page**): [docs.temporal.io/workflows](https://docs.temporal.io/workflows).

**Render workers.** Two documented shapes. Remotion Lambda: parallel chunk render on AWS, stitch, upload to S3, with the timeout and disk limits in section 3. Or a container or VM that runs `ffmpeg` or Remotion's server-side `renderMedia()` / `npx remotion render` against files in object storage. Remotion's FAQ says Remotion itself is not hosted: "You have to set up your own infrastructure." Shotstack, Creatomate, and JSON2Video are the hosted alternative: you POST JSON and poll, and they hold the render.

---

## 6. What nobody sells as one product

Grounded only in the pages above.

1. **Private-or-unlisted upload plus a real approval hold is a YouTube API feature, not a vendor feature that these products document.** `videos.insert` can set `privacyStatus` to `private` or `unlisted`, and `publishAt` only works while a video is private and has never been public. The insert default is `public`, so a client that forgets the field publishes. An API client must show the user the privacy choice. None of InVideo, Fliki, Pictory, Syllaby, Revid, AutoShorts, Opus Clip, Vizard, HeyGen, or Synthesia document that they set YouTube privacy to private or unlisted. AutoShorts documents the opposite of a mandatory gate: scheduled posts do not wait for approval. Revid's Review First is a hold, and the privacy of the later post is not documented.

2. **Generation and distribution are split.** InVideo and Pictory document a finished file and tell the user to upload it. Fliki's API returns a download URL; YouTube publish is a separate product action. HeyGen and Synthesia return an MP4 (Synthesia's private/public flag is their share page). Opus Clip and Vizard publish clips of a video you already made. The open-source READMEs that assemble a short (MoneyPrinterTurbo, ShortGPT, MoneyPrinter) do not document `privacyStatus`. MoneyPrinterPro's README is the nearest: Reddit and YouTube titles in, Selenium upload out, and it still does not mention a private hold.

3. **Trend-of-facts is not the same feature as "give us a topic."** Documented inputs are prompts, scripts, URLs, RSS, a subreddit URL (Revid), or "trending ideas" (Syllaby, without a stated source). YouTube `search.list` can find recent short videos, at 100 calls per day by default. Reddit's Data API can read posts at 100 queries per minute with OAuth, commercial use needs a separate agreement, and unregistered apps lose access starting 12 Jan 2027. Google's Trends API is an alpha you apply for. Wikipedia's extract API can supply the text of an article. None of the commercial product pages show this combination as a built-in facts desk.

4. **A full Short is assembled. The generative video APIs are clip-length.** Documented maxima: FLUX 3 video 5–20 seconds, Kling 4.0 3–30 seconds, `heygen-video-1` 5–30 seconds, Gemini Omni Flash 3–10 seconds, Runway Gen-4.5 2–10 seconds. Veo 3.1 preview on the Gemini API was shut down 22 Oct 2026. The Sora Videos API was shut down 24 Sep 2026 with no replacement listed. Stock search (Pexels, Pixabay) returns footage, not a timeline. Captions need timestamps (ElevenLabs `with-timestamps` or forced alignment). The timeline is Remotion, Shotstack, Creatomate, JSON2Video, or FFmpeg. Pexels, as of this research, is not issuing new API keys.

5. **Policy binds the channel even when the tools succeed.** Mass-produced template output and straight readings of scraped text are named examples of content that cannot be monetized under the inauthentic-content and reused-content rules. Realistic generated footage of a real place or a real event that did not happen is a named example that must be disclosed. Disclosure itself is not a monetization ban. A pipeline that uploads as public by default, or that publishes on a schedule with no review, removes the step the monetization page describes as the creator's own commentary and variation.

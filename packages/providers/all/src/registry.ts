import { ProviderRegistry } from "@vcp/core";
import * as blobLocal from "@vcp/provider-blob-local";
import * as fakeAlign from "@vcp/provider-fake-align";
import * as fakeClip from "@vcp/provider-fake-clip";
import * as fakeImage from "@vcp/provider-fake-image";
import * as fakeLlm from "@vcp/provider-fake-llm";
import * as fakePublish from "@vcp/provider-fake-publish";
import * as fakeRender from "@vcp/provider-fake-render";
import * as fakeResearch from "@vcp/provider-fake-research";
import * as fakeSource from "@vcp/provider-fake-source";
import * as fakeStock from "@vcp/provider-fake-stock";
import * as fakeTts from "@vcp/provider-fake-tts";
import * as renderRemotion from "@vcp/provider-render-remotion";
import * as sourceManual from "@vcp/provider-source-manual";

/** Every provider in the tree. Real (paid) providers arrive in M1+. */
export function createRegistry(): ProviderRegistry {
  return new ProviderRegistry()
    .register(blobLocal.manifest, blobLocal.create)
    .register(sourceManual.manifest, sourceManual.create)
    .register(fakeSource.manifest, fakeSource.create)
    .register(fakeLlm.manifest, fakeLlm.create)
    .register(fakeResearch.manifest, fakeResearch.create)
    .register(fakeTts.manifest, fakeTts.create)
    .register(fakeAlign.manifest, fakeAlign.create)
    .register(fakeStock.manifest, fakeStock.create)
    .register(fakeImage.manifest, fakeImage.create)
    .register(fakeClip.manifest, fakeClip.create)
    .register(fakeRender.manifest, fakeRender.create)
    .register(renderRemotion.manifest, renderRemotion.create)
    .register(fakePublish.manifest, fakePublish.create);
}

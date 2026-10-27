"""Edition of the docs site. The stable site (the latest release) is at the root, the `next` site (main) under /next/,
both on one origin, so they share localStorage. BUILDGUIDE_EDITION=next gives the guides of the next site their own
storage keys; the plugin has read them by the time a build starts, and writes them into the pages and files afterwards.
"""

import os


def on_pre_build(config):
    if os.environ.get("BUILDGUIDE_EDITION") == "next":
        plugin = config.plugins["buildguide"]
        for guide in (plugin.guide, *plugin.guides.values()):
            guide["storage"] += "-next"

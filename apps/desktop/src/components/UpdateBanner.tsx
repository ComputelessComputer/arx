import { openUrl, } from "@tauri-apps/plugin-opener";
import { useState, } from "react";
import { markPendingPostUpdate, type PostUpdateInfo, relaunch, type UpdateInfo, } from "../services/updater";

export function UpdateBanner({
  mode = "available",
  onDismiss,
  update,
}: {
  mode?: "available" | "updated";
  onDismiss: () => void;
  update: PostUpdateInfo | UpdateInfo;
},) {
  const [updating, setUpdating,] = useState(false,);
  const [progress, setProgress,] = useState<number | null>(null,);
  const [installed, setInstalled,] = useState(false,);
  const isUpdatedMode = mode === "updated";

  const handleUpdate = async () => {
    if (isUpdatedMode) return;

    const availableUpdate = update as UpdateInfo;
    setUpdating(true,);

    try {
      await availableUpdate.downloadAndInstall((downloaded, total,) => {
        if (total > 0) {
          setProgress(Math.round((downloaded / total) * 100,),);
        }
      },);
      markPendingPostUpdate(availableUpdate.version,);
      setInstalled(true,);
    } catch (error) {
      console.error("Update failed:", error,);
      setUpdating(false,);
      setProgress(null,);
    }
  };

  if (isUpdatedMode) {
    const postUpdate = update as PostUpdateInfo;

    return (
      <section className="arx-update-banner" aria-label={`Arx updated to version ${postUpdate.version}`}>
        <p className="arx-update-banner-copy">v{postUpdate.version} updated</p>
        <div className="arx-update-banner-actions">
          <button
            type="button"
            className="arx-update-banner-button arx-update-banner-button-secondary"
            onClick={() => void openUrl(postUpdate.releaseUrl,)}
          >
            Changelog
          </button>
          <button
            type="button"
            className="arx-update-banner-close"
            onClick={onDismiss}
            aria-label="Dismiss update banner"
          >
            ×
          </button>
        </div>
      </section>
    );
  }

  if (installed) {
    return (
      <section className="arx-update-banner" aria-label={`Arx update ${update.version} ready to restart`}>
        <p className="arx-update-banner-copy">Restart to finish updating to v{update.version}</p>
        <div className="arx-update-banner-actions">
          <button
            type="button"
            className="arx-update-banner-button arx-update-banner-button-primary"
            onClick={() => relaunch()}
          >
            Restart
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="arx-update-banner" aria-label={`Arx version ${update.version} available`}>
      <p className="arx-update-banner-copy">v{update.version} available</p>
      <div className="arx-update-banner-actions">
        <button
          type="button"
          className="arx-update-banner-button arx-update-banner-button-primary"
          onClick={() => void handleUpdate()}
          disabled={updating}
        >
          {updating
            ? progress !== null
              ? `Downloading… ${progress}%`
              : "Preparing…"
            : "Update & Restart"}
        </button>
        {!updating ? (
          <button
            type="button"
            className="arx-update-banner-close"
            onClick={onDismiss}
            aria-label="Dismiss update banner"
          >
            ×
          </button>
        ) : null}
      </div>
    </section>
  );
}

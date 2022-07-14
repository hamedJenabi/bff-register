import * as React from "react";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import styles from "./Skeleton.module.scss";

export default function SkeletonComponent() {
  return (
    <div className={styles.main}>
      <Stack spacing={1}>
        <Skeleton style={{ margin: "20px 0" }} variant="text" />
        <Skeleton
          style={{ margin: "20px 0" }}
          variant="rectangular"
          width={210}
          height={22}
        />
        <Skeleton
          style={{ margin: "20px 0" }}
          variant="rectangular"
          width={210}
          height={22}
        />
        <Skeleton
          style={{ margin: "20px 0" }}
          variant="rectangular"
          width={210}
          height={22}
        />
        <Skeleton
          style={{ margin: "20px 0" }}
          variant="rectangular"
          width={210}
          height={22}
        />
        <Skeleton
          style={{ margin: "20px 0" }}
          variant="rectangular"
          width={210}
          height={22}
        />
        <Skeleton
          style={{ margin: "20px 0" }}
          variant="rectangular"
          width={210}
          height={22}
        />
      </Stack>
    </div>
  );
}

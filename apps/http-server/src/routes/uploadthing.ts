import { createUploadthing, type FileRouter } from "uploadthing/express";

const f = createUploadthing();

export const uploadRouter: FileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  
  imageUploader: f({
    image: {
      /**
       * For full list of options and defaults and defaults, see the File Route API reference
       * @see https://docs.uploadthing.com/file-routes#route-config
       */
      maxFileSize: "4MB",
      maxFileCount: 4,
    },
  }).onUploadComplete((data) => {
    console.log("uoload there")
    console.log("upload completed", data);
  }),


  //video file uploader
  videoUploadr: f({
    video:{
      maxFileSize:"32MB",
      maxFileCount:1,
    },

  }).onUploadComplete((data) => {
    console.log("Video upload completed", data);
  })
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;

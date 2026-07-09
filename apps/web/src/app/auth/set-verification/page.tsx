"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

import { Box, Button, Divider, FormLabel, Paper, TextField, Typography } from "@mui/material";

import Logo from "@/components/logo/logo";
import { DEFAULTS } from "@/config";

export default function Page() {
  const [code, setCode] = React.useState(["", "", "", "", "", ""]);

  const router = useRouter();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    router.push(DEFAULTS.appRoot);
  };

  function onPaste(event: any) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text/plain");
    const pastedArray = ensureSixItems(pasted.split("").slice(0, code.length));
    setCode(pastedArray);
  }

  function ensureSixItems(array: string[]) {
    return [...array, ...Array(6 - array.length).fill("")].slice(0, 6);
  }

  function update(index: number) {
    return (event: any) => setCode([...code.slice(0, index), event.target.value, ...code.slice(index + 1)]);
  }

  return (
    <Box className="bg-waves flex min-h-screen w-full items-center justify-center bg-cover bg-center p-4">
      <Paper elevation={3} className="bg-background-paper shadow-darker-xs w-lg max-w-full rounded-4xl py-14">
        <Box className="flex flex-col gap-4 px-8 sm:px-14">
          <Box className="flex flex-col">
            <Box className="mb-14 flex justify-center">
              <Logo classNameMobile="hidden" />
            </Box>

            <Box className="flex flex-col gap-10">
              <Box className="flex flex-col">
                <Typography variant="h1" component="h1" className="mb-2">
                  Verification
                </Typography>
                <Typography variant="body1" className="text-text-primary">
                  Please enter your 6 digit code that sent to your email address.
                </Typography>
              </Box>

              <Box className="flex flex-col gap-5">
                <Box component={"form"} onSubmit={handleSubmit} className="flex flex-col">
                  <Box className="flex flex-col">
                    <FormLabel component="label">Verification Code</FormLabel>
                    <Box className="flex flex-row gap-1 md:gap-2">
                      {code.map((s, key) => (
                        <TextField
                          key={key}
                          variant="standard"
                          className="outlined"
                          size="small"
                          value={s}
                          onPaste={onPaste}
                          onInput={update(key)}
                          slotProps={{
                            htmlInput: {
                              maxLength: 1,
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  <Box className="flex flex-col gap-2">
                    <Button type="submit" variant="contained" className="mb-4">
                      Continue
                    </Button>
                  </Box>

                  <Typography variant="body2" className="text-text-secondary">
                    By clicking Continue, Sign in with Google, or Sign in with GitHub, you agree to the{" "}
                    <Link
                      target="_blank"
                      href="/auth/terms-and-conditions"
                      className="link-primary link-underline-hover"
                    >
                      Terms and Conditions
                    </Link>{" "}
                    and{" "}
                    <Link target="_blank" href="/auth/privacy-policy" className="link-primary link-underline-hover">
                      Privacy Policy
                    </Link>
                    .
                  </Typography>
                </Box>
              </Box>
              <Divider className="text-text-secondary my-0 text-sm"></Divider>
              <Box className="flex flex-col">
                <Typography variant="h6" component="h6">
                  Did not get the code?
                </Typography>
                <Typography variant="body1" className="text-text-secondary">
                  If you have not received the code, please{" "}
                  <Link href="/auth/get-verification" className="link-primary link-underline-hover">
                    resend
                  </Link>
                  .
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

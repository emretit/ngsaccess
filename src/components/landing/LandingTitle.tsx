export function LandingTitle({ text }: { text: string }) {
  return (
    <>
      {text.split('<br>').map((line, index) => (
        <span key={line}>
          {index > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  );
}

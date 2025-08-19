import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

function CommonForm({
  action,
  formControls,
  buttonText,
  isBtnDisabled,
  btnType,
  formData,
  setFormData,
  handleFileChange,
}) {
  function renderInputByComponentType(getCurrentControl) {
    let content = null;

    switch (getCurrentControl.componentType) {
      case "input":
        content = (
          <div className="relative mt-8">
            <Label className="text-lg font-medium">
              {getCurrentControl.label}
              {getCurrentControl.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="flex items-center mt-2">
              <Input
                type="text"
                disabled={getCurrentControl.disabled}
                placeholder={getCurrentControl.placeholder}
                name={getCurrentControl.name}
                id={getCurrentControl.name}
                value={formData[getCurrentControl.name]}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    [event.target.name]: event.target.value,
                  })
                }
                className="w-full rounded-md h-[60px] px-4 border bg-gray-100 text-lg outline-none drop-shadow-sm transition-all duration-200 ease-in-out focus:bg-white focus:drop-shadow-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                required={getCurrentControl.required}
              />
            </div>
          </div>
        );

        break;

      case "file":
        // derive a nice display name from saved URL/path in formData
        const rawVal = formData?.[getCurrentControl.name];
        const deriveFileName = (val) => {
          if (!val) return "";
          try {
            const u = new URL(val);
            const last = u.pathname.split("/").pop() || "";
            return decodeURIComponent(last);
          } catch {
            const base = String(val).split("?")[0];
            const last = base.split("/").pop() || "";
            return decodeURIComponent(last);
          }
        };
        const savedFileName = (getCurrentControl.name === "resume" && formData?.resumeOriginalName)
          ? formData.resumeOriginalName
          : deriveFileName(rawVal);

        content = (
          <div className="mt-6">
            <Label
              htmlFor={getCurrentControl.name}
              className="flex bg-gray-100 items-center justify-between gap-3 px-3 py-3 mx-auto text-center border-2 border-dashed rounded-lg cursor-pointer"
            >
              <div className="text-left">
                <h2 className="font-medium">
                  {getCurrentControl.label}
                  {getCurrentControl.required && <span className="text-red-500 ml-1">*</span>}
                </h2>
              </div>
              <div className="flex-1 text-left truncate text-gray-700">
                {savedFileName ? (
                  <span title={savedFileName} className="truncate inline-block max-w-full">
                    {savedFileName}
                  </span>
                ) : (
                  <span className="text-gray-500">No file chosen</span>
                )}
              </div>
              <div>
                <span className="inline-block bg-white border rounded px-3 py-1 text-sm">Choose File</span>
              </div>
            </Label>
            <Input
              onChange={handleFileChange}
              id={getCurrentControl.name}
              type="file"
              name={getCurrentControl.name}
              accept={getCurrentControl.accept || ".pdf,application/pdf"}
              required={getCurrentControl.required}
              className="hidden"
            />
          </div>
        );

        break;

      default:
        content = (
          <div className="relative mt-8">
            <Label className="text-lg font-medium">
              {getCurrentControl.label}
              {getCurrentControl.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="flex items-center mt-2">
              <Input
                type="text"
                disabled={getCurrentControl.disabled}
                placeholder={getCurrentControl.placeholder}
                name={getCurrentControl.name}
                id={getCurrentControl.name}
                value={formData[getCurrentControl.name]}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    [event.target.name]: event.target.value,
                  })
                }
                className="w-full rounded-md h-[60px] px-4 border bg-gray-100 text-lg outline-none drop-shadow-sm transition-all duration-200 ease-in-out focus:bg-white focus:drop-shadow-lg focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                required={getCurrentControl.required}
              />
            </div>
          </div>
        );
        break;
    }

    return content;
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      action();
    }}>
      {formControls.map((control, index) => (
        <div key={control.name || index}>
          {renderInputByComponentType(control)}
        </div>
      ))}
      <div className="mt-6 w-full">
        <Button
          type={btnType || "submit"}
          className="disabled:opacity-60 flex h-11 items-center justify-center px-5"
          disabled={isBtnDisabled}
          onClick={() => {
            console.log("Button clicked");
          }}
        >
          {buttonText}
        </Button>
      </div>
    </form>
  );
}

export default CommonForm;

package tn.damascino.reporting.api;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tn.damascino.common.cqrs.QueryBus;
import tn.damascino.common.web.ApiException;
import tn.damascino.reporting.reconciliation.ColumnMapping;
import tn.damascino.reporting.reconciliation.ReconciliationQueries;

import java.io.IOException;

/**
 * "Remise assistée" mode: the cashier applies the discount in the "Remise" menu of the till; the till sales export is
 * compared with the passages validated on the platform.
 */
@RestController
@RequestMapping("/api/reporting/reconciliation")
public class ReconciliationController {

    private final QueryBus queries;

    public ReconciliationController(QueryBus queries) {
        this.queries = queries;
    }

    /** Step 1: columns of the export and a guess of their meaning. */
    @PostMapping(path = "/inspect", consumes = "multipart/form-data")
    public ReconciliationQueries.Inspection inspect(@RequestPart("file") MultipartFile file) throws IOException {
        return queries.ask(new ReconciliationQueries.InspectSalesFile(file.getOriginalFilename(), bytes(file)));
    }

    /** Step 2: comparison with the validated passages of the same days. */
    @PostMapping(consumes = "multipart/form-data")
    public ReconciliationQueries.Report reconcile(@RequestPart("file") MultipartFile file,
                                                  @RequestParam(required = false) Integer dateTime,
                                                  @RequestParam(required = false) Integer date,
                                                  @RequestParam(required = false) Integer time,
                                                  @RequestParam(required = false) Integer ticket,
                                                  @RequestParam(required = false) Integer amount,
                                                  @RequestParam(required = false) Integer label,
                                                  @RequestParam(required = false) Integer code,
                                                  @RequestParam(required = false) Integer cashier,
                                                  @RequestParam(defaultValue = "Damascino") String discountLabel,
                                                  @RequestParam(defaultValue = "30") int toleranceMinutes) throws IOException {
        return queries.ask(new ReconciliationQueries.Reconcile(file.getOriginalFilename(), bytes(file),
                new ColumnMapping(dateTime, date, time, ticket, amount, label, code, cashier), discountLabel,
                toleranceMinutes));
    }

    private static byte[] bytes(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw ApiException.badRequest("EMPTY_FILE", "Le fichier est vide");
        }
        return file.getBytes();
    }
}
